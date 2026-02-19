import { createSignal, createResource, Show, type Component } from "solid-js";
import ErrorState from "./ErrorState.jsx";
import SetupStepInstall from "./SetupStepInstall.jsx";
import SetupStepConfigure from "./SetupStepConfigure.jsx";
import SetupStepVerify from "./SetupStepVerify.jsx";
import { getAgentKey } from "../services/api.js";

interface Props {
  agentName: string;
  onClose: () => void;
}

const STEPS = ["Install", "Configure", "Verify"] as const;

const SetupWizard: Component<Props> = (props) => {
  const [step, setStep] = createSignal(0);
  const [apiKeyData, { refetch: refetchKey }] = createResource(
    () => props.agentName,
    (name) => getAgentKey(name),
  );

  const endpoint = () => {
    const custom = apiKeyData()?.pluginEndpoint;
    if (custom) return custom;
    const host = window.location.hostname;
    if (host === "app.manifest.build") return null;
    return `${window.location.origin}/otlp`;
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) props.onClose();
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal-card" style="max-width: 560px;" onClick={(e) => e.stopPropagation()}>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span class="modal-card__title">Set up {props.agentName}</span>
          <button class="modal__close" onClick={props.onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p class="modal-card__desc">Connect your agent to start tracking its activity.</p>

        {/* Stepper */}
        <div class="modal-stepper">
          {STEPS.map((label, i) => (
            <>
              {i > 0 && <div class="modal-stepper__line" />}
              <div
                class="modal-stepper__step"
                classList={{
                  "modal-stepper__step--active": step() === i,
                  "modal-stepper__step--done": step() > i,
                }}
              >
                <div class="modal-stepper__circle">
                  <Show when={step() > i} fallback={i + 1}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </Show>
                </div>
                <span class="modal-stepper__label">{label}</span>
              </div>
            </>
          ))}
        </div>

        {/* Step content */}
        <div style="min-height: 200px;">
          <Show when={!apiKeyData.error} fallback={
            <ErrorState
              error={apiKeyData.error}
              title="Could not load API key"
              message="Failed to fetch your agent's API key. Please try again."
              onRetry={refetchKey}
            />
          }>
            <Show when={step() === 0}>
              <SetupStepInstall />
            </Show>
            <Show when={step() === 1}>
              <SetupStepConfigure
                apiKey={null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                agentName={props.agentName}
                endpoint={endpoint()}
              />
            </Show>
            <Show when={step() === 2}>
              <SetupStepVerify />
            </Show>
          </Show>
        </div>

        {/* Navigation */}
        <div class="modal-card__footer" style="gap: 8px; margin-top: var(--gap-lg);">
          <Show when={step() > 0}>
            <button class="btn btn--outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          </Show>
          <Show
            when={step() < STEPS.length - 1}
            fallback={
              <button class="btn btn--primary" onClick={props.onClose}>
                Done
              </button>
            }
          >
            <button class="btn btn--primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
