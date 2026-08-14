import { createSignal, For, Show, type Component } from 'solid-js';
import {
  clearFallbacks,
  setFallbacks,
  type AuthType,
  type AvailableModel,
  type CustomProviderData,
  type ModelRoute,
  type RequestParamDefaults,
  type ResponseMode,
  type RoutingProvider,
} from '../services/api.js';
import { customProviderColor } from '../services/formatters.js';
import { getModelLabel } from '../services/provider-utils.js';
import { PROVIDERS } from '../services/providers.js';
import {
  computeFallbackDropSlot,
  resolveProviderId,
  stripCustomPrefix,
  type RouteSlots,
  usedKeyLabelsForModelInTier,
} from '../services/routing-utils.js';
import { toast } from '../services/toast-store.js';
import { authBadgeFor } from './AuthBadge.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';
import ModelParamsAffordance from './ModelParamsAffordance.jsx';
import RouteKeyChip from './RouteKeyChip.js';
import DragGhost from './DragGhost.js';
import { modelParamsScopeForTier } from 'manifest-shared';

interface FallbackListProps {
  agentName: string;
  tier: string;
  tierData?: () => RouteSlots | undefined;
  fallbacks: string[];
  // Optional structured route per fallback. When present (length matches
  // fallbacks), each row renders provider/auth from the route instead of
  // re-deriving them from `models`/`connectedProviders` — this fixes the
  // same-name-different-auth ambiguity reported in issue #1708 without
  // changing the visible UI for users whose data has been backfilled.
  fallbackRoutes?: ModelRoute[] | null;
  responseMode?: ResponseMode;
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  connectedProviders: RoutingProvider[];
  // FallbackList always passes both arguments. The second is optional in the
  // signature so parents whose optimistic-state model doesn't track
  // fallback_routes separately can omit it and still type-check; the next
  // list refresh from the server fills routes back in.
  onUpdate: (updatedFallbacks: string[], updatedRoutes?: ModelRoute[] | null) => void;
  onAddFallback: () => void;
  adding?: boolean;
  primaryDragging?: boolean;
  onPrimaryDropAtSlot?: (slot: number) => void;
  onFallbackDragStart?: (index: number) => void;
  onFallbackDragEnd?: () => void;
  /** Touch-drag: a fallback card was released over the primary model chip. */
  onFallbackDropOnPrimary?: (index: number) => void;
  persistFallbacks?: (
    agentName: string,
    tier: string,
    models: string[],
    routes?: ModelRoute[],
  ) => Promise<unknown>;
  persistClearFallbacks?: (agentName: string, tier: string) => Promise<unknown>;
  /**
   * Per-route params getter, threaded from the routing page boundary. When
   * present, every fallback row whose provider consumes a known param key
   * renders a `<ModelParamsAffordance>` for its own `(provider, authType,
   * model)` tuple. Saving from a fallback row updates the parent's cache
   * just like saving from the primary chip does.
   */
  getModelParams?: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
  ) => RequestParamDefaults | null;
  setModelParams?: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
    params: RequestParamDefaults | null,
  ) => Promise<unknown>;
  swappingIndex?: number | null;
  modelParamsScope?: string;
  /**
   * Drop slot driven from OUTSIDE the list (the primary chip's touch drag).
   * When set, the indicator renders for this slot — same line feedback as the
   * in-list drag — so dragging the primary onto the chain shows where it will
   * land, including the very top (slot 0).
   */
  externalDropSlot?: number | null;
}

const FallbackUndoIcon: Component<{ size: 20 | 16; class?: string }> = (p) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={p.size}
    height={p.size}
    class={p.class}
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M9 10h6c2.21 0 4 1.79 4 4s-1.79 4-4 4h-3v2h3c3.31 0 6-2.69 6-6s-2.69-6-6-6H9V4L3 9l6 5z" />
  </svg>
);

const FallbackList: Component<FallbackListProps> = (props) => {
  const [removingIndex, setRemovingIndex] = createSignal<number | null>(null);
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [dropSlot, setDropSlot] = createSignal<number | null>(null);
  let listRef: HTMLDivElement | undefined;

  /** Slot shown by the drop indicators: the primary chip's touch drag when it
   * is in flight (externalDropSlot), else this list's own drag. */
  const activeDropSlot = () => props.externalDropSlot ?? dropSlot();

  const modelLabel = (model: string): string => {
    const info = props.models.find((m) => m.model_name === model);
    if (info?.display_name) return info.display_name;
    if (info) {
      const provId = resolveProviderId(info.provider);
      if (provId) return getModelLabel(provId, model);
    }
    return stripCustomPrefix(model);
  };
  const modelParamsScope = () => props.modelParamsScope ?? modelParamsScopeForTier(props.tier);

  const modelInfoFor = (model: string, index: number): AvailableModel | undefined => {
    const route = props.fallbackRoutes?.[index];
    if (route) {
      const routeProvider = resolveProviderId(route.provider)?.toLowerCase();
      const routeMatch = props.models.find((m) => {
        const modelProvider = resolveProviderId(m.provider)?.toLowerCase();
        return (
          m.model_name === route.model &&
          modelProvider === routeProvider &&
          (!m.auth_type || m.auth_type === route.authType)
        );
      });
      if (routeMatch) return routeMatch;
    }
    return (
      props.models.find((m) => m.model_name === model) ??
      props.models.find((m) => m.model_name.startsWith(model + '-'))
    );
  };

  const skippedInStream = (model: string, index: number): boolean =>
    props.responseMode === 'stream' &&
    !(modelInfoFor(model, index)?.capabilities?.includes('stream') ?? false);

  /**
   * Active labeled keys for (provider, auth_type), sorted by priority. Used
   * to decide whether to render the key chip on a fallback row — chip only
   * shows when 2+ keys exist (single-key users see the row exactly as
   * before).
   */
  const keysForFallback = (
    providerId: string | undefined,
    auth: string | null,
  ): RoutingProvider[] => {
    if (!providerId || !auth || auth === 'local') return [];
    return props.connectedProviders
      .filter(
        (p) =>
          p.provider.toLowerCase() === providerId.toLowerCase() &&
          p.auth_type === auth &&
          p.is_active &&
          p.has_api_key,
      )
      .slice()
      .sort((a, b) => a.priority - b.priority);
  };

  /**
   * Update the keyLabel pin on a single fallback row. Reads/writes through the
   * structured `fallbackRoutes` so the persisted shape stays canonical
   * (ModelRoute[] with `keyLabel`); the encoded string list is rebuilt to
   * keep optimistic-update parents that still consume `string[]` working.
   */
  const setLabelAt = async (index: number, newLabel: string | null) => {
    const original = [...props.fallbacks];
    const originalRoutes = props.fallbackRoutes ? [...props.fallbackRoutes] : null;
    const updatedRoutes: ModelRoute[] | null = originalRoutes
      ? originalRoutes.map((r, i) =>
          i === index ? ({ ...r, keyLabel: newLabel ?? null } as ModelRoute) : r,
        )
      : null;
    // Bare model names — no `||<label>` encoding now that the structured
    // `fallbackRoutes` carries keyLabel directly. The model list is just for
    // the optimistic-update parents that still consume `string[]`; the
    // canonical persisted shape is the route array.
    const updated = [...props.fallbacks];
    props.onUpdate(updated, updatedRoutes);
    try {
      await persistSet(props.agentName, props.tier, updated, updatedRoutes ?? undefined);
      toast.success(newLabel ? `Fallback pinned to "${newLabel}"` : 'Fallback key pin cleared');
    } catch {
      props.onUpdate(original, originalRoutes);
    }
  };

  const providerIdFor = (model: string, index: number): string | undefined => {
    const route = props.fallbackRoutes?.[index];
    if (route) return resolveProviderId(route.provider);
    const info = props.models.find((m) => m.model_name === model);
    if (info) return resolveProviderId(info.provider);
    return undefined;
  };

  const authTypeFor = (providerId: string | undefined, index: number): string | null => {
    const route = props.fallbackRoutes?.[index];
    if (route) return route.authType;
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

  const reorderRoutes = (
    routes: ModelRoute[] | null | undefined,
    transform: (r: ModelRoute[]) => ModelRoute[],
  ): ModelRoute[] | null => {
    if (!routes || routes.length === 0) return null;
    const next = transform([...routes]);
    return next.length > 0 ? next : null;
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    const original = [...props.fallbacks];
    const originalRoutes = props.fallbackRoutes ? [...props.fallbackRoutes] : null;
    const updated = props.fallbacks.filter((_, i) => i !== index);
    const updatedRoutes = reorderRoutes(props.fallbackRoutes, (rs) =>
      rs.filter((_, i) => i !== index),
    );
    props.onUpdate(updated, updatedRoutes);
    try {
      if (updated.length === 0) {
        await persistClear(props.agentName, props.tier);
      } else {
        await persistSet(props.agentName, props.tier, updated, updatedRoutes ?? undefined);
      }
      toast.success('Fallback removed');
    } catch {
      props.onUpdate(original, originalRoutes);
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
   * A primary-model drag is in flight when either the parent's reactive
   * `primaryDragging` flag is set OR the drag payload itself says so. The
   * dataTransfer check matters: the parent only learns about the drag on its
   * next re-render, and a fast drag's dragover/drop can land before that
   * happens. Reading the payload keeps slot computation and the drop handler
   * synchronous with the actual drag — without it, quick drags silently no-op
   * and no drop indicator ever appears.
   */
  const isPrimaryDrag = (e: DragEvent): boolean => {
    if (props.primaryDragging) return true;
    const types = e.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('application/x-primary');
  };

  /**
   * Compute the drop slot from cursor Y relative to card positions.
   * This runs on the container so it works even when hovering
   * the gaps between cards or the indicator divs.
   */
  const computeSlot = (clientY: number, primaryDrag: boolean): number | null => {
    if (!listRef) return null;
    const from = dragIndex();
    const isPrimaryDrag = primaryDrag && from === null;
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
    setDropSlot(computeSlot(e.clientY, isPrimaryDrag(e)));
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
    const primaryDrag = isPrimaryDrag(e);
    let toSlot = dropSlot();
    setDragIndex(null);
    setDropSlot(null);

    // Fast drags can land a drop without a preceding dragover on this list
    // (the last dragover happened over the chip or a gap). Recompute the slot
    // from the drop coordinates so the action never silently no-ops.
    if (toSlot === null && listRef) {
      const cards = listRef.querySelectorAll<HTMLElement>('.fallback-list__card');
      let slot = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i]!.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          slot = i;
          break;
        }
      }
      if (primaryDrag || fromIndex !== null) toSlot = slot;
    }

    // Primary model dropped into fallback list
    if (primaryDrag && fromIndex === null && toSlot !== null) {
      props.onPrimaryDropAtSlot?.(toSlot);
      return;
    }

    if (fromIndex === null || toSlot === null) return;

    await commitFallbackReorder(fromIndex, toSlot);
  };

  /** Persist a fallback reorder (shared by the HTML5 drop and touch paths). */
  const commitFallbackReorder = async (fromIndex: number, toSlot: number) => {
    const insertAt = toSlot > fromIndex ? toSlot - 1 : toSlot;
    if (insertAt === fromIndex) return;

    const original = [...props.fallbacks];
    const originalRoutes = props.fallbackRoutes ? [...props.fallbackRoutes] : null;
    const reordered = [...props.fallbacks];
    const moved = reordered.splice(fromIndex, 1)[0]!;
    reordered.splice(insertAt, 0, moved);
    const reorderedRoutes = reorderRoutes(props.fallbackRoutes, (rs) => {
      const movedRoute = rs.splice(fromIndex, 1)[0]!;
      rs.splice(insertAt, 0, movedRoute);
      return rs;
    });

    props.onUpdate(reordered, reorderedRoutes);
    try {
      await persistSet(props.agentName, props.tier, reordered, reorderedRoutes ?? undefined);
      toast.success('Fallback order updated');
    } catch {
      props.onUpdate(original, originalRoutes);
    }
  };

  // ── Touch drag (mobile) ─────────────────────────────────────────────
  // HTML5 drag-and-drop does not fire on touch devices, so fallback reorder
  // and the fallback→primary swap use pointer events. The three gestures on
  // a card are disambiguated by the initial finger direction:
  //   • vertical movement → page scroll (CSS `touch-action: pan-y`)
  //   • no movement       → tap (click behavior untouched)
  //   • horizontal swipe  → drag: the card is "picked up", a ghost card
  //                         follows the finger, and the drop line shows.
  const SWIPE_ENGAGE_PX = 14;

  let touch: { index: number; startX: number; startY: number; engaged: boolean } | null = null;
  const [touchGhost, setTouchGhost] = createSignal<{ x: number; y: number } | null>(null);

  const handleCardPointerDown = (index: number, e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    touch = { index, startX: e.clientX, startY: e.clientY, engaged: false };
  };

  const handleCardPointerMove = (e: PointerEvent) => {
    if (!touch || !listRef) return;
    if (!touch.engaged) {
      // Only a horizontal swipe picks the card up; vertical movement is
      // left to the browser so the page scrolls.
      const dx = e.clientX - touch.startX;
      const dy = e.clientY - touch.startY;
      if (Math.abs(dx) <= SWIPE_ENGAGE_PX || Math.abs(dx) <= Math.abs(dy)) return;
      touch.engaged = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragIndex(touch.index);
      props.onFallbackDragStart?.(touch.index);
    }
    e.preventDefault(); // once engaged, keep the browser from panning
    setTouchGhost({ x: e.clientX, y: e.clientY });
    const from = touch.index;
    const slot = computeFallbackDropSlot(listRef, e.clientY);
    // Don't show an indicator at the dragged item's current position.
    setDropSlot(slot === from || slot === from + 1 ? null : slot);
  };

  const handleCardPointerUp = (e: PointerEvent) => {
    if (!touch) return;
    const { index, engaged } = touch;
    const toSlot = dropSlot();
    touch = null;
    setDragIndex(null);
    setDropSlot(null);
    setTouchGhost(null);
    props.onFallbackDragEnd?.();
    if (!engaged) return; // a tap — leave click behavior alone

    // Released over the primary model chip → swap the fallback with the primary.
    const chip = listRef
      ?.closest('.routing-card')
      ?.querySelector<HTMLElement>('.routing-card__model-chip');
    const r = chip?.getBoundingClientRect();
    if (
      r &&
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    ) {
      props.onFallbackDropOnPrimary?.(index);
      return;
    }
    if (toSlot !== null) void commitFallbackReorder(index, toSlot);
  };

  const handleCardPointerCancel = () => {
    if (!touch) return;
    touch = null;
    setDragIndex(null);
    setDropSlot(null);
    setTouchGhost(null);
    props.onFallbackDragEnd?.();
  };

  /** Ghost content for the row currently being touch-dragged. */
  const ghostInfo = () => {
    const i = dragIndex();
    const g = touchGhost();
    if (i === null || g === null) return null;
    const model = props.fallbacks[i];
    if (model === undefined) return null;
    const provId = providerIdFor(model, i);
    return { ...g, label: modelLabel(model), providerId: provId, authType: authTypeFor(provId, i) };
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
            {(entry, i) => {
              // Each fallback row reads its model + (optional) keyLabel pin
              // from the structured `fallbackRoutes`, which is the canonical
              // location for the pin now that `||<label>` encoding has been
              // dropped. The bare `entry` string carries only the model name.
              const model = () => entry;
              const route = () => props.fallbackRoutes?.[i()];
              const pinnedLabel = () => route()?.keyLabel ?? null;
              const provId = () => providerIdFor(model(), i());
              const isCustom = () => provId()?.startsWith('custom:');
              const auth = () => authTypeFor(provId(), i());
              const title = () => providerTitle(provId(), auth());
              const keys = () => keysForFallback(provId(), auth());
              return (
                <>
                  <div
                    class="fallback-list__drop-indicator"
                    classList={{
                      'fallback-list__drop-indicator--active': activeDropSlot() === i(),
                    }}
                  />
                  <div
                    class="fallback-list__card"
                    classList={{
                      'fallback-list__card--dragging': dragIndex() === i(),
                      'fallback-list__card--swapping': props.swappingIndex === i(),
                      'fallback-list__card--skipped': skippedInStream(model(), i()),
                    }}
                    title={
                      skippedInStream(model(), i())
                        ? 'Skipped while Stream mode is active'
                        : undefined
                    }
                    draggable={true}
                    onDragStart={(e) => handleDragStart(i(), e)}
                    onPointerDown={(e) => handleCardPointerDown(i(), e)}
                    onPointerMove={handleCardPointerMove}
                    onPointerUp={handleCardPointerUp}
                    onPointerCancel={handleCardPointerCancel}
                    // Bind dragend on the draggable row itself rather than
                    // only on the container. When a fallback row is dropped
                    // onto the primary slot (outside this container), the
                    // container's onDragEnd doesn't always fire — the row
                    // gets re-rendered with a new model name as part of the
                    // optimistic swap, the drag source unmounts, and the
                    // container loses the bubbled event. Result: dragIndex
                    // stays set and the row keeps the --dragging class with
                    // opacity 0.3 until the next refetch. Resetting on the
                    // row itself catches every drop target.
                    onDragEnd={handleDragEnd}
                  >
                    <Show
                      when={props.swappingIndex !== i()}
                      fallback={
                        <>
                          <div
                            class="skeleton"
                            style="width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;"
                          />
                          <div class="skeleton skeleton--text" style="width: 100px;" />
                        </>
                      }
                    >
                      <Show when={provId() && !isCustom()}>
                        <span class="fallback-list__icon" title={title()}>
                          {providerIcon(provId()!, 14)}
                          {authBadgeFor(auth(), 8)}
                        </span>
                      </Show>
                      <Show when={isCustom()}>
                        {(() => {
                          const cp = props.customProviders.find(
                            (c) => `custom:${c.id}` === provId(),
                          );
                          const logo = customProviderLogo(
                            cp?.name ?? '',
                            14,
                            cp?.base_url,
                            model(),
                          );
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
                      <span class="fallback-list__model">{modelLabel(model())}</span>
                      <Show when={skippedInStream(model(), i())}>
                        <span class="routing-card__skipped-badge">Skipped in Stream</span>
                      </Show>
                      <Show when={keys().length > 1}>
                        <RouteKeyChip
                          keys={keys()}
                          currentLabel={pinnedLabel() ?? undefined}
                          modelLabel={modelLabel(model())}
                          usedLabels={() =>
                            usedKeyLabelsForModelInTier(
                              (props.tierData ?? (() => undefined))(),
                              model(),
                              i(),
                              keys()[0]?.label,
                            )
                          }
                          buttonClass="fallback-list__key-chip"
                          allowClear
                          onPick={(label) => setLabelAt(i(), label)}
                        />
                      </Show>
                      <Show
                        when={
                          props.getModelParams &&
                          props.setModelParams &&
                          provId() &&
                          auth() &&
                          auth() !== 'local'
                        }
                      >
                        <ModelParamsAffordance
                          provider={provId()}
                          authType={(auth() as AuthType) ?? undefined}
                          model={model()}
                          slotLabel={modelLabel(model())}
                          scope={modelParamsScope()}
                          agentName={props.agentName}
                          getParams={props.getModelParams!}
                          setParams={props.setModelParams!}
                        />
                      </Show>
                      <button
                        class="fallback-list__remove"
                        onClick={() => handleRemove(i())}
                        title="Remove fallback"
                        aria-label={`Remove ${modelLabel(model())}`}
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
                    </Show>
                  </div>
                </>
              );
            }}
          </For>
          <div
            class="fallback-list__drop-indicator"
            classList={{
              'fallback-list__drop-indicator--active': activeDropSlot() === props.fallbacks.length,
            }}
          />
        </div>
      </Show>
      <Show
        when={props.fallbacks.length > 0}
        fallback={
          <div class="fallback-list__empty">
            <FallbackUndoIcon size={20} class="fallback-list__empty-icon" />
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
                  <FallbackUndoIcon size={16} />
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
                <FallbackUndoIcon size={16} />
                Add fallback
              </>
            )}
          </button>
        </Show>
      </Show>
      <DragGhost
        show={ghostInfo() !== null}
        x={ghostInfo()?.x ?? 0}
        y={ghostInfo()?.y ?? 0}
        providerId={ghostInfo()?.providerId}
        authType={ghostInfo()?.authType}
        label={ghostInfo()?.label ?? ''}
      />
    </div>
  );
};

export default FallbackList;
