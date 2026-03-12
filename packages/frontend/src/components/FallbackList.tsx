import { createSignal, For, Show, type Component } from 'solid-js';
import { providerIcon } from './ProviderIcon.js';
import { authBadgeFor } from './AuthBadge.js';
import { resolveProviderId, stripCustomPrefix } from '../services/routing-utils.js';
import { getModelLabel } from '../services/provider-utils.js';
import { PROVIDERS } from '../services/providers.js';
import {
  setFallbacks,
  clearFallbacks,
  type AvailableModel,
  type CustomProviderData,
  type RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';

interface FallbackListProps {
  agentName: string;
  tier: string;
  fallbacks: string[];
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  connectedProviders: RoutingProvider[];
  onUpdate: (updatedFallbacks: string[]) => void;
  onAddFallback: () => void;
  adding?: boolean;
}

const FallbackList: Component<FallbackListProps> = (props) => {
  const [removingIndex, setRemovingIndex] = createSignal<number | null>(null);

  const modelLabel = (model: string): string => {
    const info = props.models.find((m) => m.model_name === model);
    if (info?.display_name) return info.display_name;
    if (info) {
      const provId = resolveProviderId(info.provider);
      if (provId) return getModelLabel(provId, model);
    }
    return stripCustomPrefix(model);
  };

  const providerIdFor = (model: string): string | undefined => {
    const info = props.models.find((m) => m.model_name === model);
    if (info) return resolveProviderId(info.provider);
    return undefined;
  };

  const authTypeFor = (providerId: string | undefined): string | null => {
    if (!providerId) return null;
    const provs = props.connectedProviders.filter(
      (p) => p.provider.toLowerCase() === providerId.toLowerCase(),
    );
    if (provs.some((p) => p.auth_type === 'subscription')) return 'subscription';
    if (provs.some((p) => p.auth_type === 'api_key')) return 'api_key';
    return null;
  };

  const providerTitle = (providerId: string | undefined, authType: string | null): string => {
    if (!providerId) return '';
    const provDef = PROVIDERS.find((p) => p.id === providerId);
    const name = provDef?.name ?? providerId;
    const method = authType === 'subscription' ? 'Subscription' : 'API Key';
    return `${name} (${method})`;
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    const original = [...props.fallbacks];
    const updated = props.fallbacks.filter((_, i) => i !== index);
    // Optimistic: remove from UI immediately
    props.onUpdate(updated);
    try {
      if (updated.length === 0) {
        await clearFallbacks(props.agentName, props.tier);
      } else {
        await setFallbacks(props.agentName, props.tier, updated);
      }
      toast.success('Fallback removed');
    } catch {
      // Revert on failure
      props.onUpdate(original);
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div class="fallback-list">
      <Show when={props.fallbacks.length > 0}>
        <ol class="fallback-list__items">
          <For each={props.fallbacks}>
            {(model, i) => {
              const provId = () => providerIdFor(model);
              const isCustom = () => provId()?.startsWith('custom:');
              const auth = () => authTypeFor(provId());
              const title = () => providerTitle(provId(), auth());
              return (
                <li class="fallback-list__item">
                  <span class="fallback-list__rank">{i() + 1}.</span>
                  <Show when={provId() && !isCustom()}>
                    <span class="fallback-list__icon" title={title()}>
                      {providerIcon(provId()!, 14)}
                      {authBadgeFor(auth(), 8)}
                    </span>
                  </Show>
                  <Show when={isCustom()}>
                    {(() => {
                      const cp = props.customProviders.find((c) => `custom:${c.id}` === provId());
                      const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                      return (
                        <span
                          class="provider-card__logo-letter fallback-list__icon"
                          title={cp?.name ?? 'Custom'}
                          style={{
                            background: 'var(--custom-provider-color)',
                            width: '14px',
                            height: '14px',
                            'font-size': '8px',
                            'border-radius': '50%',
                          }}
                        >
                          {letter}
                        </span>
                      );
                    })()}
                  </Show>
                  <span class="fallback-list__model">{modelLabel(model)}</span>
                  <button
                    class="fallback-list__remove"
                    onClick={() => handleRemove(i())}
                    title="Remove fallback"
                    aria-label={`Remove ${modelLabel(model)}`}
                    disabled={removingIndex() !== null}
                  >
                    {removingIndex() === i() ? '...' : '\u00d7'}
                  </button>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
      <Show when={props.fallbacks.length < 5}>
        <button
          class="fallback-list__add routing-action"
          onClick={props.onAddFallback}
          disabled={props.adding || removingIndex() !== null}
        >
          {props.adding ? <span class="spinner" /> : '+ Add fallback'}
        </button>
      </Show>
    </div>
  );
};

export default FallbackList;
