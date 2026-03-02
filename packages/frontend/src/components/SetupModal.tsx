import { createResource, createSignal, For, Show, type Component } from 'solid-js'
import SetupStepInstall from './SetupStepInstall.jsx'
import SetupStepConfigure from './SetupStepConfigure.jsx'
import SetupStepVerify from './SetupStepVerify.jsx'
import SetupStepLocalConfigure from './SetupStepLocalConfigure.jsx'
import { getAgentKey, getHealth } from '../services/api.js'

interface StepDef { n: number; label: string }

const CLOUD_STEPS: StepDef[] = [
  { n: 1, label: 'Install' },
  { n: 2, label: 'Configure' },
  { n: 3, label: 'Activate' },
]

const LOCAL_STEPS: StepDef[] = [
  { n: 1, label: 'Configure' },
  { n: 2, label: 'Verify' },
]

const SetupModal: Component<{ open: boolean; agentName: string; apiKey?: string | null; onClose: () => void; onDone?: () => void }> = (props) => {
  const [step, setStep] = createSignal(1)

  const [healthData] = createResource(() => props.open, (open) => open ? getHealth() : null)
  const isLocal = () => (healthData() as { mode?: string })?.mode === 'local'

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

  const steps = () => isLocal() ? LOCAL_STEPS : CLOUD_STEPS
  const totalSteps = () => steps().length

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
            <Show when={isLocal()} fallback={
              <>Follow these steps to send telemetry from your agent to Manifest. Once your first messages arrive, <strong>your dashboard populates automatically</strong>.</>
            }>
              <>Your local server is running. Configure the OpenClaw plugin and verify that telemetry data is flowing.</>
            </Show>
          </p>

          <div class="modal-stepper">
            <For each={steps()}>
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

          {/* Cloud flow: Install → Configure → Activate */}
          <Show when={!isLocal()}>
            <Show when={step() === 1}>
              <SetupStepInstall />
            </Show>
            <Show when={step() === 2}>
              <SetupStepConfigure
                apiKey={props.apiKey ?? null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                agentName={props.agentName}
                endpoint={endpoint()}
              />
            </Show>
            <Show when={step() === 3}>
              <SetupStepVerify />
            </Show>
          </Show>

          {/* Local flow: Configure → Verify */}
          <Show when={isLocal()}>
            <Show when={step() === 1}>
              <SetupStepLocalConfigure
                apiKey={props.apiKey ?? null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                endpoint={endpoint()}
              />
            </Show>
            <Show when={step() === 2}>
              <SetupStepVerify isLocal={isLocal()} />
            </Show>
          </Show>

          <div class="setup-modal__nav">
            <button
              class="modal-card__back-link"
              onClick={() => setStep((s) => s - 1)}
              style={step() === 1 ? 'visibility: hidden;' : ''}
            >
              Back
            </button>
            <Show when={step() < totalSteps()} fallback={
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
