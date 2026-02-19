import { createResource, createSignal, For, Show, type Component } from 'solid-js'
import SetupStepInstall from './SetupStepInstall.jsx'
import SetupStepConfigure from './SetupStepConfigure.jsx'
import SetupStepVerify from './SetupStepVerify.jsx'
import { getAgentKey } from '../services/api.js'

const SetupModal: Component<{ open: boolean; agentName: string; onClose: () => void; onDone?: () => void }> = (props) => {
  const [step, setStep] = createSignal(1)

  const [apiKeyData] = createResource(
    () => (props.open ? props.agentName : null),
    (n) => (n ? getAgentKey(n) : null),
  )

  const endpoint = () => {
    const custom = apiKeyData()?.pluginEndpoint
    if (custom) return custom
    const host = window.location.hostname
    if (host === 'app.manifest.build') return null
    return `${window.location.origin}/otlp`
  }

  return (
    <Show when={props.open}>
      <div class="modal-overlay setup-modal__overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
        <div class="modal-card" style="max-width: 600px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-sm);">
            <div class="modal-card__title">Set up your agent</div>
            <button
              style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
              onClick={() => props.onClose()}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <p class="modal-card__desc">
            Follow these steps to connect your agent to Manifest. Once your first messages come in, <strong>this dashboard unlocks automatically</strong>.
          </p>

          <div class="modal-stepper">
            <For each={[
              { n: 1, label: 'Install' },
              { n: 2, label: 'Configure' },
              { n: 3, label: 'Activate' },
            ]}>
              {(s, i) => (
                <>
                  <Show when={i() > 0}>
                    <div class="modal-stepper__line" />
                  </Show>
                  <div
                    class="modal-stepper__step"
                    classList={{
                      'modal-stepper__step--active': step() === s.n,
                      'modal-stepper__step--done': step() > s.n,
                    }}
                    onClick={() => setStep(s.n)}
                    style="cursor: pointer;"
                  >
                    <div class="modal-stepper__circle">
                      <Show when={step() > s.n} fallback={s.n}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg>
                      </Show>
                    </div>
                    <span class="modal-stepper__label">{s.label}</span>
                  </div>
                </>
              )}
            </For>
          </div>

          <Show when={step() === 1}>
            <SetupStepInstall />
          </Show>
          <Show when={step() === 2}>
            <SetupStepConfigure
              apiKey={null}
              keyPrefix={apiKeyData()?.keyPrefix ?? null}
              agentName={props.agentName}
              endpoint={endpoint()}
            />
          </Show>
          <Show when={step() === 3}>
            <SetupStepVerify />
          </Show>

          <div class="setup-modal__nav">
            <button
              class="modal-card__back-link"
              onClick={() => setStep((s) => s - 1)}
              style={step() === 1 ? 'visibility: hidden;' : ''}
            >
              Back
            </button>
            <Show when={step() < 3} fallback={
              <button
                class="setup-modal__next"
                onClick={() => { props.onDone?.(); props.onClose(); }}
              >
                Done
              </button>
            }>
              <button
                class="setup-modal__next"
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default SetupModal
