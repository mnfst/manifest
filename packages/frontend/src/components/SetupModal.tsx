import { createResource, Show, type Component } from 'solid-js';
import SetupStepAddProvider from './SetupStepAddProvider.jsx';
import SetupStepLocalReady from './SetupStepLocalReady.jsx';
import ErrorState from './ErrorState.jsx';
import { getAgentKey, getHealth } from '../services/api.js';

const SetupModal: Component<{
  open: boolean;
  agentName: string;
  apiKey?: string | null;
  onClose: () => void;
  onDone?: () => void;
  onGoToRouting?: () => void;
}> = (props) => {
  const [healthData] = createResource(
    () => props.open,
    (open) => (open ? getHealth() : null),
  );
  // Health check failure defaults to cloud mode
  const isLocal = () => (healthData() as { mode?: string })?.mode === 'local';

  const [apiKeyData, { refetch: refetchKey }] = createResource(
    () => (props.open ? props.agentName : null),
    (n) => (n ? getAgentKey(n) : null),
  );

  const baseUrl = () => {
    if (isLocal()) return `${window.location.origin}/v1`;
    const custom = apiKeyData()?.pluginEndpoint;
    if (custom) return custom;
    const host = window.location.hostname;
    if (host === 'app.manifest.build') return 'https://app.manifest.build/v1';
    return `${window.location.origin}/v1`;
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
          <div class="setup-modal__header">
            <div class="modal-card__title" id="setup-modal-title">
              Set up {props.agentName}
            </div>
            <button class="modal__close" onClick={() => props.onClose()} aria-label="Close">
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
              fallback="Add Manifest as a model provider, then connect at least one LLM so routing works."
            >
              Your local agent is pre-configured. Connect an LLM provider to enable routing.
            </Show>
          </p>

          <Show
            when={!apiKeyData.error || !!props.apiKey}
            fallback={
              <ErrorState
                error={apiKeyData.error}
                title="Could not load API key"
                message="Failed to fetch your agent's API key. Please try again."
                onRetry={refetchKey}
              />
            }
          >
            <Show
              when={!isLocal()}
              fallback={
                <SetupStepLocalReady
                  apiKey={props.apiKey ?? null}
                  keyPrefix={apiKeyData()?.keyPrefix ?? null}
                  baseUrl={baseUrl()}
                />
              }
            >
              <SetupStepAddProvider
                apiKey={props.apiKey ?? null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                baseUrl={baseUrl()}
              />
            </Show>
          </Show>

          <div class="setup-modal__nav">
            <span />
            <button class="setup-modal__next" onClick={handleGoToRouting}>
              Connect providers
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default SetupModal;
