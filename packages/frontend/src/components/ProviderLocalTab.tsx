import { For, type Accessor, type Component } from 'solid-js';
import {
  CANONICAL_LOCAL_IDS,
  SHARED_PROVIDER_BY_ID_OR_ALIAS,
  normalizeProviderName,
} from 'manifest-shared';
import type { AuthType, CustomProviderData } from '../services/api.js';
import { customProviderColor } from '../services/formatters.js';
import type { ProviderDef } from '../services/providers.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';

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
  localProviders: ProviderDef[];
  customProviders: CustomProviderData[];
  /**
   * Reports whether the agent has an active user_providers row with
   * `auth_type: 'local'` for the given key. The key is `prov.id`
   * (`ollama`) for standard tiles and `custom:<uuid>` for custom-backed
   * tiles (LM Studio). A single check covers both because the user_providers
   * row is the source of truth for "is this provider actively routing?".
   */
  isConnected: (providerKey: string) => boolean;
  /**
   * Disable a connected local provider — flips the toggle OFF and
   * marks the user_providers row inactive so routing stops selecting it.
   * `providerKey` matches the argument to `isConnected()`.
   */
  onToggle: (providerKey: string) => void | Promise<void>;
  busy: Accessor<boolean>;
  onOpenDetail: (provId: string, authType: AuthType) => void;
  onEditCustom: (cp: CustomProviderData) => void;
  onOpenLocalServer: (prov: ProviderDef) => void;
}

const ProviderLocalTab: Component<Props> = (props) => {
  const mergedProviders = (): ListItem[] => {
    const customs = props.customProviders ?? [];
    const claimed = new Set<string>();
    for (const cp of customs) {
      const id = resolveCanonicalId(cp.name);
      if (id) claimed.add(id);
    }
    const standards: ListItem[] = props.localProviders
      .filter((prov) => !claimed.has(prov.id))
      .map((prov) => ({ kind: 'standard', prov }));
    // Only surface custom providers that resolve to a canonical local tile
    // (LM Studio, Ollama named). Freeform custom providers stay on the API
    // Keys tab since we don't know they point at localhost.
    const customItems: ListItem[] = customs
      .filter((cp) => resolveCanonicalId(cp.name) !== null)
      .map((cp) => ({ kind: 'custom', cp }));
    return [...standards, ...customItems].sort((a, b) => {
      const nameA = a.kind === 'standard' ? a.prov.name : a.cp.name;
      const nameB = b.kind === 'standard' ? b.prov.name : b.cp.name;
      return nameA.localeCompare(nameB);
    });
  };

  return (
    <>
      <div class="provider-modal__tab-hint">
        Runs on your own machine. No key, no cost, no network. Messages routed here are tagged with
        a pink tepee badge.
      </div>
      <div class="provider-modal__list">
        <For each={mergedProviders()}>
          {(item) => {
            if (item.kind === 'custom') {
              const cp = item.cp;
              const providerKey = `custom:${cp.id}`;
              const connected = () => props.isConnected(providerKey);
              const handleClick = () => {
                // When the provider is connected, a click on the tile
                // disconnects it — same UX as the Subscription tab.
                // Editing the base_url / model list happens from the
                // routing card in the main page, not here.
                if (connected()) {
                  props.onToggle(providerKey);
                  return;
                }
                props.onEditCustom(cp);
              };
              return (
                <button class="provider-toggle" disabled={props.busy()} onClick={handleClick}>
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
                    <span class="provider-toggle__name">{cp.name}</span>
                  </span>
                  <span
                    class="provider-toggle__switch"
                    classList={{ 'provider-toggle__switch--on': connected() }}
                  >
                    <span class="provider-toggle__switch-thumb" />
                  </span>
                </button>
              );
            }

            const prov = item.prov;
            const connected = () => props.isConnected(prov.id);
            const hasLocalPort = () => prov.defaultLocalPort !== undefined;

            const handleClick = () => {
              if (connected()) {
                props.onToggle(prov.id);
                return;
              }
              if (hasLocalPort()) {
                props.onOpenLocalServer(prov);
                return;
              }
              props.onOpenDetail(prov.id, 'local');
            };

            return (
              <button class="provider-toggle" disabled={props.busy()} onClick={handleClick}>
                <span class="provider-toggle__icon">
                  {providerIcon(prov.id, 20) ?? (
                    <span class="provider-card__logo-letter" style={{ background: prov.color }}>
                      {prov.initial}
                    </span>
                  )}
                </span>
                <span class="provider-toggle__info">
                  <span class="provider-toggle__name">{prov.name}</span>
                </span>
                <span
                  class="provider-toggle__switch"
                  classList={{ 'provider-toggle__switch--on': connected() }}
                >
                  <span class="provider-toggle__switch-thumb" />
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </>
  );
};

export default ProviderLocalTab;
