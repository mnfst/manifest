import { createSignal, For, Show, type Component } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import type { StageDef } from '../services/providers.js';
import { getModelLabel } from '../services/provider-utils.js';
import { providerIcon, customProviderLogo } from '../components/ProviderIcon.js';
import { authBadgeFor } from '../components/AuthBadge.js';
import { pricePerM, resolveProviderId, inferProviderFromModel } from '../services/routing-utils.js';
import { customProviderColor } from '../services/formatters.js';
import { manifestThinkingDefault } from 'manifest-shared';
import FallbackList from '../components/FallbackList.js';
import ModelParamsDialog from '../components/ModelParamsDialog.js';
import { setFallbacks as setFallbacksApi } from '../services/api.js';
import { toast } from '../services/toast-store.js';
import type {
  TierAssignment,
  AvailableModel,
  AuthType,
  ModelRoute,
  RequestParamDefaults,
  RoutingProvider,
  CustomProviderData,
} from '../services/api.js';

function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m =
    apiModels.find((x) => x.model_name === model) ??
    apiModels.find((x) => x.model_name.startsWith(model + '-'));
  if (m) {
    const dbId = resolveProviderId(m.provider);
    // Ollama providers keep their DB id to avoid the colon-suffix heuristic in
    // inferProviderFromModel mis-routing cloud models to local Ollama.
    if (dbId === 'ollama' || dbId === 'ollama-cloud') return dbId;
    const prefixId = inferProviderFromModel(m.model_name);
    if (prefixId && PROVIDERS.find((p) => p.id === prefixId)) return prefixId;
    return dbId ?? prefixId;
  }
  const prefix = inferProviderFromModel(model);
  if (prefix && PROVIDERS.find((p) => p.id === prefix)) return prefix;
  for (const prov of PROVIDERS) {
    if (
      prov.models.some(
        (pm) =>
          pm.value === model ||
          model.startsWith(pm.value + '-') ||
          pm.value.startsWith(model + '-'),
      )
    ) {
      return prov.id;
    }
  }
  return undefined;
}

export interface RoutingTierCardProps {
  stage: StageDef;
  tier: () => TierAssignment | undefined;
  models: () => AvailableModel[];
  customProviders: () => CustomProviderData[];
  activeProviders: () => RoutingProvider[];
  tiersLoading: boolean;
  changingTier: () => string | null;
  resettingTier: () => string | null;
  resettingAll: () => boolean;
  addingFallback: () => string | null;
  agentName: () => string;
  onDropdownOpen: (tierId: string) => void;
  onOverride: (tierId: string, model: string, providerId: string, authType?: AuthType) => void;
  onReset: (tierId: string) => void;
  onFallbackUpdate: (
    tierId: string,
    fallbacks: string[],
    fallbackRoutes?: ModelRoute[] | null,
  ) => void;
  onAddFallback: (tierId: string) => void;
  getFallbacksFor: (tierId: string) => string[];
  connectedProviders: () => RoutingProvider[];
  persistFallbacks?: (
    agentName: string,
    tier: string,
    models: string[],
    routes?: ModelRoute[],
  ) => Promise<unknown>;
  persistClearFallbacks?: (agentName: string, tier: string) => Promise<unknown>;
  /**
   * Persist per-assignment request body defaults. When omitted the params
   * affordance is hidden, so callers that don't yet have a backend route
   * for the surface (e.g. header tiers) can drop in without changes.
   */
  persistParamDefaults?: (
    agentName: string,
    slot: string,
    paramDefaults: RequestParamDefaults | null,
  ) => Promise<unknown>;
  onParamDefaultsSaved?: (slot: string, paramDefaults: RequestParamDefaults | null) => void;
}

const effectiveRoute = (
  t: TierAssignment,
): { provider: string; authType: AuthType; model: string } | null =>
  t.override_route ?? t.auto_assigned_route;

const effectiveModel = (t: TierAssignment): string | null => effectiveRoute(t)?.model ?? null;

const RoutingTierCard: Component<RoutingTierCardProps> = (props) => {
  const eff = () => {
    const t = props.tier();
    return t ? effectiveModel(t) : null;
  };
  const manualProviderId = () => {
    const t = props.tier();
    return t?.override_route?.provider;
  };
  const isManual = () => props.tier()?.override_route != null;
  const hasFallbacks = () => (props.tier()?.fallback_routes ?? []).length > 0;
  const hasCustomizations = () => isManual() || hasFallbacks();
  const [confirmReset, setConfirmReset] = createSignal(false);
  const [primaryDragging, setPrimaryDragging] = createSignal(false);
  const [fallbackDragging, setFallbackDragging] = createSignal<number | null>(null);
  const [primaryDropTarget, setPrimaryDropTarget] = createSignal(false);
  const [paramsOpen, setParamsOpen] = createSignal(false);
  const paramDefaults = () => props.tier()?.param_defaults ?? null;
  const hasParamDefaults = () => paramDefaults() !== null;
  // Resolve the effective provider for whichever model is currently routed
  // (override or auto-assigned). The params popup only makes sense for
  // providers whose API actually consumes the configurable knobs, so we
  // gate the affordance on a known thinking default.
  const effectiveProviderId = () => {
    const model = eff();
    if (!model) return undefined;
    return manualProviderId() ?? providerIdForModel(model, props.models());
  };
  // Manifest's effective default for this slot — provider's default unless
  // tier semantics give us a reason to override (e.g. simple/standard/complex
  // get thinking off when the provider would otherwise default it on).
  const thinkingDefault = () => manifestThinkingDefault(effectiveProviderId(), props.stage.id);

  const saveParamDefaults = async (next: RequestParamDefaults | null) => {
    const persist = props.persistParamDefaults;
    if (!persist) return;
    try {
      await persist(props.agentName(), props.stage.id, next);
      props.onParamDefaultsSaved?.(props.stage.id, next);
      toast.success(next ? 'Model parameters updated' : 'Model parameters cleared');
    } catch {
      // fetchMutate already toasted the error
    }
  };

  const handlePrimaryDragStart = (e: DragEvent) => {
    setPrimaryDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'primary');
      e.dataTransfer.setData('application/x-primary', 'true');
    }
  };

  const handlePrimaryDragEnd = () => {
    setPrimaryDragging(false);
    setPrimaryDropTarget(false);
  };

  const handlePrimaryDragOver = (e: DragEvent) => {
    if (fallbackDragging() === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setPrimaryDropTarget(true);
  };

  const handlePrimaryDragLeave = () => {
    setPrimaryDropTarget(false);
  };

  const handlePrimaryDrop = (e: DragEvent) => {
    e.preventDefault();
    setPrimaryDropTarget(false);
    const fbIndex = fallbackDragging();
    if (fbIndex === null) return;
    setFallbackDragging(null);
    swapPrimaryWithFallback(fbIndex);
  };

  const handlePrimaryDropAtSlot = async (slot: number) => {
    const tier = props.tier();
    if (!tier) return;
    const currentModel = eff();
    if (!currentModel) return;
    // Carry the full primary route through the swap. Without this, the same
    // model name on a different auth (subscription vs api_key) collapses back
    // to "first match in discovery" when the backend rebuilds fallback_routes
    // — and the UI ends up rendering a ghost row whose auth no longer matches.
    const currentRoute = effectiveRoute(tier);
    const fallbacks = props.getFallbacksFor(props.stage.id);
    const fallbackRoutes = tier.fallback_routes ?? null;
    // Build the unified list: insert current primary at drop slot
    const newFallbacks = [...fallbacks];
    newFallbacks.splice(slot, 0, currentModel);
    const newPrimary = newFallbacks.shift()!;
    if (newPrimary === currentModel && slot === 0) return; // no-op
    // Build the parallel route list when we have full coverage. If any
    // fallback predates the dual-write migration we drop to legacy persist.
    const buildRoutes = (): typeof fallbackRoutes => {
      if (!currentRoute || !fallbackRoutes || fallbackRoutes.length !== fallbacks.length) {
        return null;
      }
      const next = [...fallbackRoutes];
      next.splice(slot, 0, currentRoute);
      next.shift();
      return next;
    };
    const newRoutes = buildRoutes();
    // Resolve the new primary's route for the override call.
    const newPrimaryRoute =
      newRoutes && newRoutes.length === newFallbacks.length
        ? // newPrimary came from position 0 of the post-splice list, which
          // corresponds to the original fallback at the same slot
          fallbackRoutes![0]
        : null;
    // Optimistic update: set BOTH model names and routes so the FallbackList
    // doesn't render new names against stale fallback_routes (causes a gray
    // ghost row when the routes describe a different auth than the new model).
    props.onFallbackUpdate(props.stage.id, newFallbacks, newRoutes);
    try {
      const persistFn = props.persistFallbacks ?? setFallbacksApi;
      await persistFn(props.agentName(), props.stage.id, newFallbacks, newRoutes ?? undefined);
    } catch {
      props.onFallbackUpdate(props.stage.id, fallbacks, fallbackRoutes);
      toast.error('Failed to update fallbacks');
      return;
    }
    const provId = newPrimaryRoute?.provider ?? providerIdForModel(newPrimary, props.models());
    props.onOverride(props.stage.id, newPrimary, provId ?? '', newPrimaryRoute?.authType);
  };

  const swapPrimaryWithFallback = async (fbIndex: number) => {
    const tier = props.tier();
    if (!tier) return;
    const currentModel = eff();
    if (!currentModel) return;
    const currentRoute = effectiveRoute(tier);
    const fallbacks = props.getFallbacksFor(props.stage.id);
    const fbModel = fallbacks[fbIndex];
    if (!fbModel) return;
    const fallbackRoutes = tier.fallback_routes ?? null;
    const fbRoute = fallbackRoutes?.[fbIndex] ?? null;
    // Swap: fallback model goes to primary, current primary takes its place.
    // Carry routes alongside model names so same-name-different-auth swaps
    // don't collapse to a single auth on persist.
    const newFallbacks = [...fallbacks];
    newFallbacks[fbIndex] = currentModel;
    const newRoutes =
      fallbackRoutes && currentRoute && fallbackRoutes.length === fallbacks.length
        ? fallbackRoutes.map((r, i) => (i === fbIndex ? currentRoute : r))
        : null;
    props.onFallbackUpdate(props.stage.id, newFallbacks, newRoutes);
    try {
      const persistFn = props.persistFallbacks ?? setFallbacksApi;
      await persistFn(props.agentName(), props.stage.id, newFallbacks, newRoutes ?? undefined);
    } catch {
      props.onFallbackUpdate(props.stage.id, fallbacks, fallbackRoutes);
      toast.error('Failed to update fallbacks');
      return;
    }
    const provId = fbRoute?.provider ?? providerIdForModel(fbModel, props.models());
    props.onOverride(props.stage.id, fbModel, provId ?? '', fbRoute?.authType);
  };

  const modelInfo = (modelName: string): AvailableModel | undefined => {
    const all = props.models();
    return (
      all.find((m) => m.model_name === modelName) ??
      all.find((m) => m.model_name.startsWith(modelName + '-'))
    );
  };

  const labelFor = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (info) {
      if (info.display_name) {
        const provName = info.provider_display_name;
        return provName ? `${provName} / ${info.display_name}` : info.display_name;
      }
      const prefixId = inferProviderFromModel(modelName);
      const provId =
        prefixId && PROVIDERS.find((p) => p.id === prefixId)
          ? prefixId
          : resolveProviderId(info.provider);
      if (provId) return getModelLabel(provId, modelName);
    }
    return modelName;
  };

  const priceLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return '';
    return `${pricePerM(info.input_price_per_token)} in · ${pricePerM(info.output_price_per_token)} out per 1M`;
  };

  return (
    <div class="routing-card">
      <div class="routing-card__header">
        <span class="routing-card__tier">{props.stage.label}</span>
        <Show when={hasCustomizations()}>
          <button
            class="routing-card__header-action routing-card__header-action--danger"
            onClick={() => setConfirmReset(true)}
            disabled={props.resettingTier() === props.stage.id || props.resettingAll()}
          >
            {props.resettingTier() === props.stage.id ? (
              <span class="spinner" style="width: 12px; height: 12px;" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m7.77,12.97c.49.41,1.23.06,1.23-.58v-2.4h6c2.21,0,4,1.79,4,4v5c0,.55.45,1,1,1s1-.45,1-1v-5c0-3.31-2.69-6-6-6h-6v-2.4c0-.64-.74-.98-1.23-.58l-4.08,3.4c-.36.3-.36.85,0,1.15l4.08,3.4Z" />
              </svg>
            )}
            Reset
          </button>
        </Show>
        <Show when={!eff() && !props.tiersLoading}>
          <button
            class="routing-card__header-add"
            onClick={() => props.onDropdownOpen(props.stage.id)}
          >
            + Add model
          </button>
        </Show>
      </div>
      <Show
        when={!props.tiersLoading}
        fallback={
          <div class="routing-card__body">
            <div class="skeleton skeleton--text" style="width: 160px; height: 14px;" />
            <div
              class="skeleton skeleton--text"
              style="width: 200px; height: 12px; margin-top: 6px;"
            />
          </div>
        }
      >
        <div class="routing-card__body">
          <Show when={eff()} fallback={null}>
            {(modelName) => {
              const provId = () =>
                manualProviderId() ?? providerIdForModel(modelName(), props.models());
              const effectiveAuth = (): AuthType | null => {
                const t = props.tier();
                const route = t ? effectiveRoute(t) : null;
                if (route?.authType) return route.authType;
                const id = provId();
                if (!id) return null;
                const provs = props
                  .activeProviders()
                  .filter((p) => p.provider.toLowerCase() === id.toLowerCase());
                if (provs.some((p) => p.auth_type === 'subscription')) return 'subscription';
                if (provs.some((p) => p.auth_type === 'api_key')) return 'api_key';
                return null;
              };
              return (
                <>
                  <Show
                    when={props.changingTier() !== props.stage.id}
                    fallback={
                      <div class="routing-card__model-chip">
                        <div class="skeleton skeleton--text" style="width: 140px; height: 14px;" />
                      </div>
                    }
                  >
                    <div
                      class="routing-card__model-chip"
                      classList={{
                        'routing-card__model-chip--dragging': primaryDragging(),
                        'routing-card__model-chip--drop-target': primaryDropTarget(),
                      }}
                      draggable={true}
                      onDragStart={handlePrimaryDragStart}
                      onDragEnd={handlePrimaryDragEnd}
                      onDragOver={handlePrimaryDragOver}
                      onDragLeave={handlePrimaryDragLeave}
                      onDrop={handlePrimaryDrop}
                    >
                      <div class="routing-card__chip-main">
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
                        <div class="routing-card__override">
                          <Show
                            when={provId()?.startsWith('custom:')}
                            fallback={
                              <Show when={provId()}>
                                {(p) => (
                                  <span class="routing-card__override-icon">
                                    {providerIcon(p(), 14)}
                                    {authBadgeFor(effectiveAuth(), 8)}
                                  </span>
                                )}
                              </Show>
                            }
                          >
                            {(() => {
                              const cp = () =>
                                props.customProviders()?.find((c) => `custom:${c.id}` === provId());
                              const logo = () => {
                                const c = cp();
                                return c
                                  ? customProviderLogo(c.name, 14, c.base_url, modelName())
                                  : null;
                              };
                              return (
                                <span class="routing-card__override-icon">
                                  <Show
                                    when={logo()}
                                    fallback={
                                      <span
                                        class="provider-card__logo-letter"
                                        style={{
                                          background: customProviderColor(cp()?.name ?? 'C'),
                                          width: '14px',
                                          height: '14px',
                                          'font-size': '8px',
                                          'border-radius': '50%',
                                        }}
                                      >
                                        {(cp()?.name ?? 'C').charAt(0).toUpperCase()}
                                      </span>
                                    }
                                  >
                                    {logo()}
                                  </Show>
                                </span>
                              );
                            })()}
                          </Show>
                          <span class="routing-card__main">{labelFor(modelName())}</span>
                          <Show when={!isManual()}>
                            <span class="routing-card__auto-tag">auto</span>
                          </Show>
                        </div>
                        <Show when={props.persistParamDefaults && thinkingDefault()}>
                          <button
                            class="routing-card__chip-action"
                            onClick={() => setParamsOpen(true)}
                            aria-label={`Configure parameters for ${props.stage.label}`}
                            classList={{
                              'routing-card__chip-action--active': hasParamDefaults(),
                            }}
                          >
                            <span class="routing-tooltip">
                              {hasParamDefaults() ? 'Parameters configured' : 'Parameters'}
                            </span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path d="M3 6h7a3 3 0 0 1 6 0h2a1 1 0 1 1 0 2h-2a3 3 0 0 1-6 0H3a1 1 0 0 1 0-2zm0 10h11a3 3 0 0 1 6 0h1a1 1 0 1 1 0 2h-1a3 3 0 0 1-6 0H3a1 1 0 1 1 0-2zm10-9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm5 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                            </svg>
                          </button>
                        </Show>
                        <button
                          class="routing-card__chip-action"
                          onClick={() => props.onDropdownOpen(props.stage.id)}
                          disabled={props.changingTier() === props.stage.id}
                          aria-label={`Change model for ${props.stage.label}`}
                        >
                          <span class="routing-tooltip">Change</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M2.75 9h3.44c.67 0 1-.81.53-1.28l-.85-.85c.15-.18.31-.36.48-.52.73-.74 1.59-1.31 2.54-1.71 1.97-.83 4.26-.83 6.23 0 .95.4 1.81.98 2.54 1.72.74.73 1.31 1.59 1.71 2.54.3.72.5 1.46.58 2.23.05.5.48.88.99.88.6 0 1.07-.52 1-1.12-.11-.95-.35-1.88-.72-2.77-.5-1.19-1.23-2.26-2.14-3.18S17.09 3.3 15.9 2.8a10.12 10.12 0 0 0-7.79 0c-1.19.5-2.26 1.23-3.18 2.14-.17.17-.32.35-.48.52L3.28 4.29C2.81 3.82 2 4.15 2 4.82v3.44c0 .41.34.75.75.75ZM21.25 15h-3.44c-.67 0-1 .81-.53 1.28l.85.85c-.15.18-.31.36-.48.52-.73.74-1.59 1.31-2.54 1.71-1.97.83-4.26.83-6.23 0-.95-.4-1.81-.98-2.54-1.72a7.8 7.8 0 0 1-1.71-2.54c-.3-.72-.5-1.46-.58-2.23a.99.99 0 0 0-.99-.88c-.6 0-1.07.52-1 1.12.11.95.35 1.88.72 2.77.5 1.19 1.23 2.26 2.14 3.18S6.91 20.7 8.1 21.2c1.23.52 2.54.79 3.89.79s2.66-.26 3.89-.79c1.19-.5 2.26-1.23 3.18-2.14.17-.17.32-.35.48-.52l1.17 1.17c.47.47 1.28.14 1.28-.53v-3.44c0-.41-.34-.75-.75-.75Z" />
                          </svg>
                        </button>
                      </div>
                      <div class="routing-card__chip-footer">
                        <Show
                          when={effectiveAuth() !== 'subscription'}
                          fallback={
                            <span class="routing-card__chip-price">Included in subscription</span>
                          }
                        >
                          <span class="routing-card__chip-price">{priceLabel(modelName())}</span>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </>
              );
            }}
          </Show>
        </div>
        <Show when={eff()}>
          <div class="routing-card__right">
            <FallbackList
              agentName={props.agentName()}
              tier={props.stage.id}
              fallbacks={props.getFallbacksFor(props.stage.id)}
              fallbackRoutes={props.tier()?.fallback_routes ?? null}
              models={props.models()}
              customProviders={props.customProviders()}
              connectedProviders={props.activeProviders()}
              onUpdate={(updatedFallbacks, updatedRoutes) =>
                // Thread routes through optimistic state so the UI doesn't
                // render the new model list against stale fallback_routes
                // (the gray "ghost row" bug for same-name-different-auth).
                props.onFallbackUpdate(props.stage.id, updatedFallbacks, updatedRoutes)
              }
              onAddFallback={() => props.onAddFallback(props.stage.id)}
              adding={props.addingFallback() === props.stage.id}
              primaryDragging={primaryDragging()}
              onPrimaryDropAtSlot={handlePrimaryDropAtSlot}
              onFallbackDragStart={(index) => setFallbackDragging(index)}
              onFallbackDragEnd={() => setFallbackDragging(null)}
              persistFallbacks={props.persistFallbacks}
              persistClearFallbacks={props.persistClearFallbacks}
            />
          </div>
        </Show>
      </Show>

      <Show when={thinkingDefault()}>
        {(providerDefault) => (
          <ModelParamsDialog
            open={paramsOpen()}
            slotLabel={props.stage.label.toLowerCase()}
            current={paramDefaults()}
            providerDefault={providerDefault()}
            onSave={async (next) => {
              await saveParamDefaults(next);
            }}
            onClose={() => setParamsOpen(false)}
          />
        )}
      </Show>

      <Show when={confirmReset()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmReset(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmReset(false);
          }}
        >
          <div
            class="modal-card"
            style="max-width: 420px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-tier-modal-title"
          >
            <h2
              id="reset-tier-modal-title"
              style="margin: 0 0 12px; font-size: var(--font-size-lg); font-weight: 600;"
            >
              Reset tier?
            </h2>
            <p style="margin: 0 0 20px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              This will clear the model override and remove all fallback models for this tier.
            </p>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button class="btn btn--outline" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                class="btn btn--danger"
                disabled={props.resettingTier() === props.stage.id}
                onClick={() => {
                  setConfirmReset(false);
                  props.onReset(props.stage.id);
                }}
              >
                {props.resettingTier() === props.stage.id ? <span class="spinner" /> : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default RoutingTierCard;
