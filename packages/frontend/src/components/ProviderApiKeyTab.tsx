import { For, Show, type Component, createSignal, onMount } from 'solid-js';
import { SHARED_PROVIDER_BY_ID_OR_ALIAS, normalizeProviderName } from 'manifest-shared';
import type { AuthType, CustomProviderData } from '../services/api.js';
import { customProviderColor } from '../services/formatters.js';
import type { ProviderDef } from '../services/providers.js';
import type { CustomProviderPrefill } from '../services/routing-params.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';
import { checkIsSelfHosted } from '../services/setup-status.js';

// Canonical local-LLM ids: when a custom provider is named after one of
// these, we treat it as "the" connection for that tile — we hide the
// empty tileOnly entry and drop the "Custom" tag so the row doesn't look
// like a secondary, off-brand copy.
const CANONICAL_LOCAL_IDS = new Set(['lmstudio', 'ollama']);

const resolveCanonicalId = (name: string): string | null => {
  const shared =
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName(name)) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(name) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(name.toLowerCase());
  return shared && CANONICAL_LOCAL_IDS.has(shared.id) ? shared.id : null;
};

type ListItem =
  | { kind: 'standard'; prov: ProviderDef }
  | { kind: 'custom'; cp: CustomProviderData };

interface Props {
  apiKeyProviders: ProviderDef[];
  customProviders: CustomProviderData[];
  isConnected: (provId: string) => boolean;
  isNoKeyConnected: (provId: string) => boolean;
  onOpenDetail: (provId: string, authType: AuthType) => void;
  onOpenCustomForm: (prefill?: CustomProviderPrefill) => void;
  onEditCustom: (cp: CustomProviderData) => void;
  /**
   * Tile click for local server providers (LM Studio today) that have a
   * `defaultLocalPort` — opens the auto-probing detail view instead of
   * the generic custom-provider form.
   */
  onOpenLocalServer: (prov: ProviderDef) => void;
}

const ProviderApiKeyTab: Component<Props> = (props) => {
  const [isSelfHosted, setIsSelfHosted] = createSignal(false);

  onMount(async () => {
    setIsSelfHosted(await checkIsSelfHosted());
  });

  const mergedProviders = (): ListItem[] => {
    const customs = props.customProviders ?? [];
    // Any canonical local-LLM id already claimed by a custom provider.
    // We hide the empty tileOnly entry for these so the user sees one
    // "LM Studio" row instead of a connected + disconnected duplicate.
    const claimed = new Set<string>();
    for (const cp of customs) {
      const id = resolveCanonicalId(cp.name);
      if (id) claimed.add(id);
    }
    const standards: ListItem[] = props.apiKeyProviders
      .filter((prov) => !claimed.has(prov.id))
      .map((prov) => ({ kind: 'standard', prov }));
    const customItems: ListItem[] = customs.map((cp) => ({ kind: 'custom', cp }));
    return [...standards, ...customItems].sort((a, b) => {
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
              // When a custom row resolves to a canonical local-LLM id
              // (LM Studio, Ollama) treat it as the native tile — drop
              // the "Custom" badge so the row looks like a first-class
              // provider rather than a side-channel.
              const isCanonical = resolveCanonicalId(cp.name) !== null;
              return (
                <button class="provider-toggle" onClick={() => props.onEditCustom(cp)}>
                  <span class="provider-toggle__icon">
                    {customProviderLogo(cp.name, 20, cp.base_url) ?? (
                      <span
                        class="provider-card__logo-letter"
                        style={{ background: customProviderColor(cp.name) }}
                      >
                        {cp.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span class="provider-toggle__info">
                    <span class="provider-toggle__name">
                      {cp.name}
                      <Show when={!isCanonical}>
                        <span class="provider-toggle__tag">Custom</span>
                      </Show>
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
            const hasLocalPort = () => prov.defaultLocalPort !== undefined;

            // Local-only tiles are greyed in cloud mode (a gate, not a
            // todo). In the self-hosted version they stay clickable even
            // when the server isn't reachable — clicking opens the detail
            // view where the setup command, retry, and docs link live.
            const disabled = () => prov.localOnly && !isSelfHosted();
            const statusMessage = () =>
              disabled() ? 'Only available on self-hosted Manifest' : null;

            const handleClick = () => {
              if (disabled()) return;
              if (hasLocalPort()) {
                props.onOpenLocalServer(prov);
                return;
              }
              props.onOpenDetail(prov.id, 'api_key');
            };

            return (
              <button class="provider-toggle" disabled={disabled()} onClick={handleClick}>
                <span class="provider-toggle__icon">
                  {providerIcon(prov.id, 20) ?? (
                    <span class="provider-card__logo-letter" style={{ background: prov.color }}>
                      {prov.initial}
                    </span>
                  )}
                </span>
                <span class="provider-toggle__info">
                  <span class="provider-toggle__name">{prov.name}</span>
                  <Show when={statusMessage()}>
                    <span class="provider-toggle__local-only">{statusMessage()}</span>
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
          <button class="provider-modal__add-custom-chip" onClick={() => props.onOpenCustomForm()}>
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
