import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import SetupStepAddProvider from './SetupStepAddProvider.jsx';
import SetupStepLocalConfigure from './SetupStepLocalConfigure.jsx';
import SetupStepProviders from './SetupStepProviders.jsx';
import { getAgentKey, getHealth } from '../services/api.js';

interface StepDef {
  n: number;
  label: string;
}

const CLOUD_STEPS: StepDef[] = [
  { n: 1, label: 'Add Provider' },
  { n: 2, label: 'Connect Models' },
];

const LOCAL_STEPS: StepDef[] = [
  { n: 1, label: 'Configure' },
  { n: 2, label: 'Connect Models' },
];

const SetupModal: Component<{
  open: boolean;
  agentName: string;
  apiKey?: string | null;
  onClose: () => void;
  onDone?: () => void;
  onGoToRouting?: () => void;
}> = (props) => {
  const [step, setStep] = createSignal(1);

  const [healthData] = createResource(
    () => props.open,
    (open) => (open ? getHealth() : null),
  );
  const isLocal = () => (healthData() as { mode?: string })?.mode === 'local';

  const [apiKeyData] = createResource(
    () => (props.open ? props.agentName : null),
    (n) => (n ? getAgentKey(n) : null),
  );

  const baseUrl = () => {
    const custom = apiKeyData()?.pluginEndpoint;
    if (custom) return custom;
    const host = window.location.hostname;
    if (host === 'app.manifest.build') return 'https://app.manifest.build/v1';
    return `${window.location.origin}/v1`;
  };

  const steps = () => (isLocal() ? LOCAL_STEPS : CLOUD_STEPS);
  const totalSteps = () => steps().length;
  const isLastStep = () => step() === totalSteps();

  const handleFinish = () => {
    props.onDone?.();
    props.onClose();
  };

  const handleGoToRouting = () => {
    props.onDone?.();
    props.onClose();
    props.onGoToRouting?.();
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay setup-modal__overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 600px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="setup-modal-title"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-sm);">
            <div class="modal-card__title" id="setup-modal-title">
              Set up your agent
            </div>
            <button
              style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;"
              onClick={() => props.onClose()}
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <p class="modal-card__desc">
            <Show
              when={isLocal()}
              fallback={
                <>
                  Add Manifest as a provider in your client, then connect at least one LLM provider
                  so routing can work.
                </>
              }
            >
              <>
                Your local server is running. Connect at least one LLM provider to start routing
                requests.
              </>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setStep(s.n);
                      }
                    }}
                    role="button"
                    tabindex="0"
                    aria-label={`Step ${s.n}: ${s.label}${step() > s.n ? ' (completed)' : step() === s.n ? ' (current)' : ''}`}
                    style="cursor: pointer;"
                  >
                    <div class="modal-stepper__circle">
                      <Show when={step() > s.n} fallback={s.n}>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Show>
                    </div>
                    <span class="modal-stepper__label">{s.label}</span>
                  </div>
                </>
              )}
            </For>
          </div>

          {/* Cloud flow: Add Provider → Connect Models */}
          <Show when={!isLocal()}>
            <Show when={step() === 1}>
              <SetupStepAddProvider
                apiKey={props.apiKey ?? null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                baseUrl={baseUrl()}
              />
            </Show>
          </Show>

          {/* Local flow: Configure → Connect Models */}
          <Show when={isLocal()}>
            <Show when={step() === 1}>
              <SetupStepLocalConfigure
                apiKey={props.apiKey ?? null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                baseUrl={baseUrl()}
              />
            </Show>
          </Show>

          {/* Connect Models step (last step for both flows) */}
          <Show when={isLastStep()}>
            <SetupStepProviders agentName={props.agentName} onGoToRouting={handleGoToRouting} />
          </Show>

          <div class="setup-modal__nav">
            <button
              class="modal-card__back-link"
              onClick={() => setStep((s) => s - 1)}
              style={step() === 1 ? 'visibility: hidden;' : ''}
              tabindex={step() === 1 ? -1 : 0}
            >
              Back
            </button>
            <Show
              when={step() < totalSteps()}
              fallback={
                <button class="setup-modal__next" onClick={handleFinish}>
                  Done
                </button>
              }
            >
              <button class="setup-modal__next" onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default SetupModal;
