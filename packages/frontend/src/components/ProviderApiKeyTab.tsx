import { For, Show, type Component } from 'solid-js';
import type { AuthType, CustomProviderData } from '../services/api.js';
import { customProviderColor } from '../services/formatters.js';
import { isLocalMode } from '../services/local-mode.js';
import type { ProviderDef } from '../services/providers.js';
import { providerIcon } from './ProviderIcon.js';

type ListItem =
  | { kind: 'standard'; prov: ProviderDef }
  | { kind: 'custom'; cp: CustomProviderData };

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
  const mergedProviders = (): ListItem[] => {
    const standards: ListItem[] = props.apiKeyProviders.map((prov) => ({ kind: 'standard', prov }));
    const customs: ListItem[] = (props.customProviders ?? []).map((cp) => ({ kind: 'custom', cp }));
    return [...standards, ...customs].sort((a, b) => {
      const nameA = a.kind === 'standard' ? a.prov.name : a.cp.name;
      const nameB = b.kind === 'standard' ? b.prov.name : b.cp.name;
      return nameA.localeCompare(nameB);
    });
  };

  return (
    <>
      <div class="provider-modal__tab-hint">Connect providers using your own API keys (BYOK).</div>
      <div class="provider-modal__list">
        <For each={mergedProviders()}>
          {(item) => {
            if (item.kind === 'custom') {
              const cp = item.cp;
              return (
                <button class="provider-toggle" onClick={() => props.onEditCustom(cp)}>
                  <span class="provider-toggle__icon">
                    <span
                      class="provider-card__logo-letter"
                      style={{ background: customProviderColor(cp.name) }}
                    >
                      {cp.name.charAt(0).toUpperCase()}
                    </span>
                  </span>
                  <span class="provider-toggle__info">
                    <span class="provider-toggle__name">
                      {cp.name}
                      <span class="provider-toggle__tag">Custom</span>
                    </span>
                  </span>
                  <span class="provider-toggle__switch provider-toggle__switch--on">
                    <span class="provider-toggle__switch-thumb" />
                  </span>
                </button>
              );
            }

            const prov = item.prov;
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
        <div class="provider-modal__add-custom">
          <button class="provider-modal__add-custom-chip" onClick={props.onOpenCustomForm}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8.46 11h7.08a1.755 1.755 0 0 0 1.43-2.77l-3.54-4.96c-.66-.92-2.19-.92-2.85 0L7.04 8.23A1.755 1.755 0 0 0 8.47 11ZM12 4.72 15.06 9H8.95l3.06-4.28ZM17.5 13c-2.48 0-4.5 2.02-4.5 4.5s2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5-2.02-4.5-4.5-4.5m0 7a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5M3.75 22h5.5c.96 0 1.75-.79 1.75-1.75v-5.5c0-.96-.79-1.75-1.75-1.75h-5.5C2.79 13 2 13.79 2 14.75v5.5c0 .96.79 1.75 1.75 1.75M4 15h5v5H4z" />
            </svg>
            Add custom provider
          </button>
        </div>
      </div>
    </>
  );
};

export default ProviderApiKeyTab;
