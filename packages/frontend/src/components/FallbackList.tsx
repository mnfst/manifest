import { createSignal, For, Show, type Component } from 'solid-js';
import { providerIcon } from './ProviderIcon.js';
import { resolveProviderId, stripCustomPrefix } from '../services/routing-utils.js';
import {
  setFallbacks,
  clearFallbacks,
  type AvailableModel,
  type CustomProviderData,
} from '../services/api.js';

interface FallbackListProps {
  agentName: string;
  tier: string;
  fallbacks: string[];
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  onUpdate: () => void;
  onAddFallback: () => void;
  adding?: boolean;
}

const FallbackList: Component<FallbackListProps> = (props) => {
  const [removingIndex, setRemovingIndex] = createSignal<number | null>(null);

  const modelLabel = (model: string): string => {
    const info = props.models.find((m) => m.model_name === model);
    if (info?.display_name) return info.display_name;
    return stripCustomPrefix(model);
  };

  const providerIdFor = (model: string): string | undefined => {
    const info = props.models.find((m) => m.model_name === model);
    if (info) return resolveProviderId(info.provider);
    return undefined;
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    const updated = props.fallbacks.filter((_, i) => i !== index);
    try {
      if (updated.length === 0) {
        await clearFallbacks(props.agentName, props.tier);
      } else {
        await setFallbacks(props.agentName, props.tier, updated);
      }
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
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
              return (
                <li class="fallback-list__item">
                  <span class="fallback-list__rank">{i() + 1}.</span>
                  <Show when={provId() && !isCustom()}>
                    <span class="fallback-list__icon">{providerIcon(provId()!, 14)}</span>
                  </Show>
                  <Show when={isCustom()}>
                    {(() => {
                      const cp = props.customProviders.find((c) => `custom:${c.id}` === provId());
                      const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                      return (
                        <span
                          class="provider-card__logo-letter fallback-list__icon"
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
          {props.adding ? 'Adding...' : '+ Add fallback'}
        </button>
      </Show>
    </div>
  );
};

export default FallbackList;
