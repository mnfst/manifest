import { createSignal, For, Show, type Component } from 'solid-js';
import {
  clearFallbacks,
  setFallbacks,
  type AvailableModel,
  type CustomProviderData,
  type RoutingProvider,
} from '../services/api.js';
import { customProviderColor } from '../services/formatters.js';
import { getModelLabel } from '../services/provider-utils.js';
import { PROVIDERS } from '../services/providers.js';
import { resolveProviderId, stripCustomPrefix } from '../services/routing-utils.js';
import { toast } from '../services/toast-store.js';
import { authBadgeFor } from './AuthBadge.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';

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
  primaryDragging?: boolean;
  onPrimaryDropAtSlot?: (slot: number) => void;
  onFallbackDragStart?: (index: number) => void;
  onFallbackDragEnd?: () => void;
  persistFallbacks?: (agentName: string, tier: string, models: string[]) => Promise<unknown>;
  persistClearFallbacks?: (agentName: string, tier: string) => Promise<unknown>;
}

const FallbackList: Component<FallbackListProps> = (props) => {
  const [removingIndex, setRemovingIndex] = createSignal<number | null>(null);
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [dropSlot, setDropSlot] = createSignal<number | null>(null);
  let listRef: HTMLDivElement | undefined;

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

  const persistSet = props.persistFallbacks ?? setFallbacks;
  const persistClear = props.persistClearFallbacks ?? clearFallbacks;

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    const original = [...props.fallbacks];
    const updated = props.fallbacks.filter((_, i) => i !== index);
    props.onUpdate(updated);
    try {
      if (updated.length === 0) {
        await persistClear(props.agentName, props.tier);
      } else {
        await persistSet(props.agentName, props.tier, updated);
      }
      toast.success('Fallback removed');
    } catch {
      props.onUpdate(original);
    } finally {
      setRemovingIndex(null);
    }
  };

  const handleDragStart = (index: number, e: DragEvent) => {
    setDragIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.setData('application/x-fallback', String(index));
    }
    props.onFallbackDragStart?.(index);
  };

  /**
   * Compute the drop slot from cursor Y relative to card positions.
   * This runs on the container so it works even when hovering
   * the gaps between cards or the indicator divs.
   */
  const computeSlot = (clientY: number): number | null => {
    if (!listRef) return null;
    const from = dragIndex();
    const isPrimaryDrag = props.primaryDragging && from === null;
    if (from === null && !isPrimaryDrag) return null;

    const cards = listRef.querySelectorAll<HTMLElement>('.fallback-list__card');
    if (cards.length === 0) return isPrimaryDrag ? 0 : null;

    // Find which slot the cursor is closest to.
    // Slots are: before card 0, between card 0 and 1, ..., after last card.
    let slot = cards.length; // default: after the last card
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i]!.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        slot = i;
        break;
      }
    }

    // Don't show indicator at the dragged item's current position (no-op move)
    if (!isPrimaryDrag && (slot === from || slot === from! + 1)) return null;
    return slot;
  };

  const handleContainerDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDropSlot(computeSlot(e.clientY));
  };

  const handleContainerDragLeave = (e: DragEvent) => {
    // Only clear when leaving the container entirely
    const related = e.relatedTarget as Node | null;
    if (!related || !listRef?.contains(related)) {
      setDropSlot(null);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    const fromIndex = dragIndex();
    const toSlot = dropSlot();
    setDragIndex(null);
    setDropSlot(null);

    // Primary model dropped into fallback list
    if (props.primaryDragging && fromIndex === null && toSlot !== null) {
      props.onPrimaryDropAtSlot?.(toSlot);
      return;
    }

    if (fromIndex === null || toSlot === null) return;

    const insertAt = toSlot > fromIndex ? toSlot - 1 : toSlot;
    if (insertAt === fromIndex) return;

    const original = [...props.fallbacks];
    const reordered = [...props.fallbacks];
    const moved = reordered.splice(fromIndex, 1)[0]!;
    reordered.splice(insertAt, 0, moved);

    props.onUpdate(reordered);
    try {
      await persistSet(props.agentName, props.tier, reordered);
      toast.success('Fallback order updated');
    } catch {
      props.onUpdate(original);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropSlot(null);
    props.onFallbackDragEnd?.();
  };

  return (
    <div class="fallback-list">
      <Show when={props.fallbacks.length > 0 || props.primaryDragging}>
        <div
          ref={listRef}
          class="fallback-list__items"
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          <For each={props.fallbacks}>
            {(model, i) => {
              const provId = () => providerIdFor(model);
              const isCustom = () => provId()?.startsWith('custom:');
              const auth = () => authTypeFor(provId());
              const title = () => providerTitle(provId(), auth());
              return (
                <>
                  <div
                    class="fallback-list__drop-indicator"
                    classList={{
                      'fallback-list__drop-indicator--active': dropSlot() === i(),
                    }}
                  />
                  <div
                    class="fallback-list__card"
                    classList={{
                      'fallback-list__card--dragging': dragIndex() === i(),
                    }}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(i(), e)}
                  >
                    <span class="fallback-list__drag-handle" aria-hidden="true">
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                        <circle cx="2" cy="2" r="1.2" />
                        <circle cx="6" cy="2" r="1.2" />
                        <circle cx="2" cy="7" r="1.2" />
                        <circle cx="6" cy="7" r="1.2" />
                        <circle cx="2" cy="12" r="1.2" />
                        <circle cx="6" cy="12" r="1.2" />
                      </svg>
                    </span>
                    <Show when={provId() && !isCustom()}>
                      <span class="fallback-list__icon" title={title()}>
                        {providerIcon(provId()!, 14)}
                        {authBadgeFor(auth(), 8)}
                      </span>
                    </Show>
                    <Show when={isCustom()}>
                      {(() => {
                        const cp = props.customProviders.find((c) => `custom:${c.id}` === provId());
                        const logo = customProviderLogo(cp?.name ?? '', 14, cp?.base_url, model);
                        if (logo) {
                          return (
                            <span class="fallback-list__icon" title={cp?.name ?? 'Custom'}>
                              {logo}
                            </span>
                          );
                        }
                        const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                        return (
                          <span
                            class="provider-card__logo-letter fallback-list__icon"
                            title={cp?.name ?? 'Custom'}
                            style={{
                              background: customProviderColor(cp?.name ?? ''),
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
                      {removingIndex() === i() ? (
                        <span class="spinner" style="width: 10px; height: 10px;" />
                      ) : (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                </>
              );
            }}
          </For>
          <div
            class="fallback-list__drop-indicator"
            classList={{
              'fallback-list__drop-indicator--active': dropSlot() === props.fallbacks.length,
            }}
          />
        </div>
      </Show>
      <Show
        when={props.fallbacks.length > 0}
        fallback={
          <div class="fallback-list__empty">
            <svg
              class="fallback-list__empty-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 22h2V8h4L7 2 2 8h4zM19 2h-2v14h-4l5 6 5-6h-4z" />
            </svg>
            <span class="fallback-list__empty-title">No fallbacks</span>
            <span class="fallback-list__empty-desc">
              Add fallback models to guarantee a response if the provider fails.
            </span>
            <button
              class="btn btn--outline btn--sm fallback-list__add"
              onClick={props.onAddFallback}
              disabled={props.adding}
            >
              {props.adding ? (
                <span class="spinner" />
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="m7.12,20.57c.2.23.55.23.75,0l2.4-2.74c.28-.32.05-.83-.38-.83h-1.9V3.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v13.5h-1.9c-.43,0-.66.51-.38.83l2.4,2.74Z" />
                    <path d="m14.1,7h1.9v13.5c0,.28.22.5.5.5s.5-.22.5-.5V7h1.9c.43,0,.66-.51.38-.83l-2.4-2.74c-.2-.23-.55-.23-.75,0l-2.4,2.74c-.28.32-.05.83.38.83Z" />
                  </svg>
                  Add fallback
                </>
              )}
            </button>
          </div>
        }
      >
        <Show when={props.fallbacks.length < 5}>
          <button
            class="btn btn--outline btn--sm fallback-list__add"
            onClick={props.onAddFallback}
            disabled={props.adding || removingIndex() !== null}
          >
            {props.adding ? (
              <span class="spinner" />
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m7.12,20.57c.2.23.55.23.75,0l2.4-2.74c.28-.32.05-.83-.38-.83h-1.9V3.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v13.5h-1.9c-.43,0-.66.51-.38.83l2.4,2.74Z" />
                  <path d="m14.1,7h1.9v13.5c0,.28.22.5.5.5s.5-.22.5-.5V7h1.9c.43,0,.66-.51.38-.83l-2.4-2.74c-.2-.23-.55-.23-.75,0l-2.4,2.74c-.28.32-.05.83.38.83Z" />
                </svg>
                Add fallback
              </>
            )}
          </button>
        </Show>
      </Show>
    </div>
  );
};

export default FallbackList;
