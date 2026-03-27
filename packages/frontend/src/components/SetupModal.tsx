import { createResource, Show, type Component } from 'solid-js';
import SetupStepAddProvider from './SetupStepAddProvider.jsx';
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
  const isLocal = () => (healthData() as { mode?: string })?.mode === 'local';

  const [apiKeyData] = createResource(
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
            Add Manifest as a model provider, then connect at least one LLM so routing works.
          </p>

          <SetupStepAddProvider
            apiKey={props.apiKey ?? null}
            keyPrefix={apiKeyData()?.keyPrefix ?? null}
            baseUrl={baseUrl()}
          />

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
