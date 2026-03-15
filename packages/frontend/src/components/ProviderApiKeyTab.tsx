import { For, Show, type Component } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import { providerIcon } from './ProviderIcon.js';
import type { CustomProviderData, AuthType } from '../services/api.js';
import { isLocalMode } from '../services/local-mode.js';

interface Props {
  apiKeyProviders: ProviderDef[];
  customProviders: CustomProviderData[];
  isConnected: (provId: string) => boolean;
  isNoKeyConnected: (provId: string) => boolean;
  onOpenDetail: (provId: string, authType: AuthType) => void;
  onOpenCustomForm: () => void;
  onEditCustom: (cp: CustomProviderData) => void;
}

const ProviderApiKeyTab: Component<Props> = (props) => {
  return (
    <>
      <div class="provider-modal__tab-hint">Connect providers using your own API keys (BYOK).</div>
      <div class="provider-modal__list">
        <For each={props.apiKeyProviders}>
          {(prov) => {
            const connected = () => props.isConnected(prov.id) || props.isNoKeyConnected(prov.id);
            const disabled = () => !!prov.localOnly && !isLocalMode();

            return (
              <button
                class="provider-toggle"
                disabled={disabled()}
                onClick={() => !disabled() && props.onOpenDetail(prov.id, 'api_key')}
              >
                <span class="provider-toggle__icon">
                  {providerIcon(prov.id, 20) ?? (
                    <span class="provider-card__logo-letter" style={{ background: prov.color }}>
                      {prov.initial}
                    </span>
                  )}
                </span>
                <span class="provider-toggle__info">
                  <span class="provider-toggle__name">{prov.name}</span>
                  <Show when={disabled()}>
                    <span class="provider-toggle__local-only">
                      Only available on Manifest Local
                    </span>
                  </Show>
                </span>
                <Show when={!disabled()}>
                  <span
                    class="provider-toggle__switch"
                    classList={{ 'provider-toggle__switch--on': connected() }}
                  >
                    <span class="provider-toggle__switch-thumb" />
                  </span>
                </Show>
              </button>
            );
          }}
        </For>
        <a
          class="provider-modal__request-link"
          href="https://github.com/mnfst/manifest/discussions/973"
          target="_blank"
          rel="noopener noreferrer"
        >
          Request new model
        </a>
      </div>

      <div class="custom-provider-section">
        <div class="custom-provider-section__header">Custom providers</div>
        <For each={props.customProviders}>
          {(cp) => (
            <button class="provider-toggle" onClick={() => props.onEditCustom(cp)}>
              <span class="provider-toggle__icon">
                <span
                  class="provider-card__logo-letter"
                  style={{ background: 'var(--custom-provider-color)' }}
                >
                  {cp.name.charAt(0).toUpperCase()}
                </span>
              </span>
              <span class="provider-toggle__info">
                <span class="provider-toggle__name">{cp.name}</span>
                <span class="provider-toggle__local-only">
                  {cp.models.length} model{cp.models.length !== 1 ? 's' : ''}
                </span>
              </span>
            </button>
          )}
        </For>
        <button
          class="provider-toggle"
          onClick={props.onOpenCustomForm}
          style="color: hsl(var(--primary));"
        >
          <span class="provider-toggle__icon" style="color: hsl(var(--primary));">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
          </span>
          <span class="provider-toggle__info">
            <span class="provider-toggle__name">Add custom provider</span>
          </span>
        </button>
      </div>
    </>
  );
};

export default ProviderApiKeyTab;
