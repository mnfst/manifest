import { type Component, Show, createResource, createSignal } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import ModelSelectDropdown from './ModelSelectDropdown.jsx';
import SetupStepAddProvider from './SetupStepAddProvider.jsx';
import { PROVIDERS } from '../services/providers.js';
import { getAgentKey } from '../services/api.js';
import { agentPlatform } from '../services/agent-platform-store.js';

interface Props {
  open: boolean;
  mode: 'enable' | 'disable';
  agentName: string;
  connectedProvider?: string | null;
  onClose: () => void;
}

const RoutingInstructionModal: Component<Props> = (props) => {
  const [selectedModel, setSelectedModel] = createSignal<string | null>(null);
  const [selectedLabel, setSelectedLabel] = createSignal<string | null>(null);
  const isEnable = () => props.mode === 'enable';
  const providerName = () => {
    if (!props.connectedProvider) return null;
    return PROVIDERS.find((p) => p.id === props.connectedProvider)?.name ?? props.connectedProvider;
  };
  const title = () => (isEnable() ? 'Activate routing' : 'Deactivate routing');
  const modelOrPlaceholder = () => selectedModel() ?? '<provider/model>';

  const [apiKeyData] = createResource(
    () => (props.open && isEnable() ? props.agentName : null),
    (n) => getAgentKey(n),
  );

  const baseUrl = () => {
    const host = window.location.hostname;
    if (host === 'app.manifest.build') return 'https://app.manifest.build/v1';
    return `${window.location.origin}/v1`;
  };

  const displayKey = () =>
    apiKeyData()?.apiKey ??
    (apiKeyData()?.keyPrefix ? `${apiKeyData()!.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const isKeyTruncated = () => !apiKeyData()?.apiKey;

  const enableCmd = () => {
    const providerJson = JSON.stringify({
      baseUrl: baseUrl(),
      api: 'openai-completions',
      apiKey: displayKey(),
      models: [{ id: 'auto', name: 'Manifest Auto' }],
    });
    return `openclaw config set models.providers.manifest '${providerJson}'\nopenclaw config set agents.defaults.model.primary manifest/auto\nopenclaw gateway restart`;
  };

  const disableCmd = () =>
    `openclaw config unset models.providers.manifest\nopenclaw config unset agents.defaults.models.manifest/auto\nopenclaw config set agents.defaults.model.primary ${modelOrPlaceholder()}\nopenclaw gateway restart`;
  const command = () => (isEnable() ? enableCmd() : disableCmd());

  const handleModelSelect = (cliValue: string, displayLabel: string) => {
    setSelectedModel(cliValue);
    setSelectedLabel(displayLabel);
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 640px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="routing-instruction-title"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <h2
              id="routing-instruction-title"
              style="margin: 0; font-size: var(--font-size-lg); font-weight: 600;"
            >
              {title()}
            </h2>
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <Show
            when={isEnable()}
            fallback={
              <>
                <p style="margin: 0 0 14px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
                  This will stop routing requests through Manifest and restore direct model access
                  in your OpenClaw agent.
                </p>

                <p style="margin: 0 0 8px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
                  1. Pick the model your agent should use directly:
                </p>

                <ModelSelectDropdown selectedValue={selectedModel()} onSelect={handleModelSelect} />

                <p style="margin: 14px 0; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
                  2. Run these commands in your agent's terminal to restore direct model access:
                </p>

                <div class="modal-terminal">
                  <div class="modal-terminal__header">
                    <div class="modal-terminal__dots">
                      <span class="modal-terminal__dot modal-terminal__dot--red" />
                      <span class="modal-terminal__dot modal-terminal__dot--yellow" />
                      <span class="modal-terminal__dot modal-terminal__dot--green" />
                    </div>
                    <div class="modal-terminal__tabs">
                      <span class="modal-terminal__tab modal-terminal__tab--active">Terminal</span>
                    </div>
                  </div>
                  <div class="modal-terminal__body">
                    <CopyButton text={disableCmd()} />
                    <div>
                      <span class="modal-terminal__prompt">$</span>
                      <span class="modal-terminal__code">
                        openclaw config unset models.providers.manifest
                      </span>
                    </div>
                    <div style="margin-top: 8px;">
                      <span class="modal-terminal__prompt">$</span>
                      <span class="modal-terminal__code">
                        openclaw config unset agents.defaults.models.manifest/auto
                      </span>
                    </div>
                    <div style="margin-top: 8px;">
                      <span class="modal-terminal__prompt">$</span>
                      <span class="modal-terminal__code">
                        openclaw config set agents.defaults.model.primary {modelOrPlaceholder()}
                      </span>
                    </div>
                    <div style="margin-top: 8px;">
                      <span class="modal-terminal__prompt">$</span>
                      <span class="modal-terminal__code">openclaw gateway restart</span>
                    </div>
                  </div>
                </div>
              </>
            }
          >
            <SetupStepAddProvider
              apiKey={apiKeyData()?.apiKey ?? null}
              keyPrefix={apiKeyData()?.keyPrefix ?? null}
              baseUrl={baseUrl()}
              platform={agentPlatform()}
            />
          </Show>

          <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn--primary btn--sm" onClick={() => props.onClose()}>
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default RoutingInstructionModal;
