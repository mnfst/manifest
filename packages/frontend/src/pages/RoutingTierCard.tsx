import { createSignal, Show, type Component } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import type { StageDef } from '../services/providers.js';
import { getModelLabel } from '../services/provider-utils.js';
import {
  resolveProviderId,
  inferProviderFromModel,
  usedKeyLabelsForModelInTier,
} from '../services/routing-utils.js';
import { providerIdForModel } from '../services/routing-model-utils.js';
import ModelParamsAffordance from '../components/ModelParamsAffordance.jsx';
import RoutingTierModelSlots from '../components/RoutingTierModelSlots.js';
import RouteKeyChip from '../components/RouteKeyChip.js';
import { setFallbacks as setFallbacksApi } from '../services/api.js';
import { modelParamsScopeForTier } from 'manifest-shared';

export { providerIdForModel } from '../services/routing-model-utils.js';
import type {
  TierAssignment,
  AvailableModel,
  AuthType,
  ModelRoute,
  RequestParamDefaults,
  RoutingProvider,
  CustomProviderData,
} from '../services/api.js';

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
  onOverride: (
    tierId: string,
    model: string,
    providerId: string,
    authType?: AuthType,
    providerKeyLabel?: string,
  ) => void;
  onPinKey?: (
    tierId: string,
    providerId: string,
    providerKeyLabel: string | null,
    authType?: AuthType,
  ) => void;
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
   * Read saved per-route params from the parent's loaded map. The
   * affordance reads through this so saving in one slot reflects on every
   * other slot that resolves to the same `(provider, authType, model)`.
   */
  getModelParams?: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
  ) => RequestParamDefaults | null;
  /**
   * Persist new params for a single route. Parent owns the server call
   * and the local cache update; the card just threads the callback down.
   */
  setModelParams?: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
    params: RequestParamDefaults | null,
  ) => Promise<unknown>;
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
  const primaryRoute = () => {
    const t = props.tier();
    return t ? effectiveRoute(t) : null;
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

  const modelCapabilities = (modelName: string) => modelInfo(modelName)?.capabilities;
  const isStreamMode = () => props.tier()?.response_mode === 'stream';

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
            <div class="routing-card__model-chip">
              <div class="routing-card__chip-main">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div
                    class="skeleton"
                    style="width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;"
                  />
                  <div class="skeleton skeleton--text" style="width: 120px;" />
                </div>
              </div>
              <div class="routing-card__chip-footer">
                <div class="skeleton skeleton--text" style="width: 150px; height: 12px;" />
              </div>
            </div>
          </div>
        }
      >
        <RoutingTierModelSlots
          agentName={props.agentName()}
          tierId={props.stage.id}
          models={props.models()}
          customProviders={props.customProviders()}
          connectedProviders={props.activeProviders()}
          primaryModel={eff}
          primaryRoute={primaryRoute}
          fallbacks={() => props.getFallbacksFor(props.stage.id)}
          fallbackRoutes={() => props.tier()?.fallback_routes ?? null}
          responseMode={() => props.tier()?.response_mode ?? 'buffered'}
          providerIdForPrimary={() => {
            const m = eff();
            if (!m) return undefined;
            return manualProviderId() ?? providerIdForModel(m, props.models());
          }}
          effectiveAuthForPrimary={() => {
            const route = primaryRoute();
            if (route?.authType) return route.authType;
            const id =
              manualProviderId() ??
              (eff() ? providerIdForModel(eff()!, props.models()) : undefined);
            if (!id) return null;
            const provs = props
              .activeProviders()
              .filter((p) => p.provider.toLowerCase() === id.toLowerCase());
            if (provs.some((p) => p.auth_type === 'subscription')) return 'subscription';
            if (provs.some((p) => p.auth_type === 'api_key')) return 'api_key';
            return null;
          }}
          primaryLabel={labelFor}
          primarySkipped={() => {
            const m = eff();
            return !!m && isStreamMode() && !(modelCapabilities(m)?.includes('stream') ?? false);
          }}
          onFallbackUpdate={(updatedFallbacks, updatedRoutes) =>
            props.onFallbackUpdate(props.stage.id, updatedFallbacks, updatedRoutes)
          }
          onPrimaryOverride={(model, provider, authType, keyLabel) =>
            props.onOverride(props.stage.id, model, provider, authType, keyLabel)
          }
          persistFallbacks={props.persistFallbacks ?? setFallbacksApi}
          persistClearFallbacks={props.persistClearFallbacks}
          onAddFallback={() => props.onAddFallback(props.stage.id)}
          addingFallback={props.addingFallback() === props.stage.id}
          modelParamsScope={modelParamsScopeForTier(props.stage.id)}
          getModelParams={props.getModelParams}
          setModelParams={props.setModelParams}
          tierData={props.tier}
          showSwappingSkeleton={() => props.changingTier() === props.stage.id}
          renderPrimaryExtension={() => (
            <Show when={!isManual()}>
              <span class="routing-card__auto-tag">auto</span>
            </Show>
          )}
          renderPrimaryActions={(modelName) => {
            const provId = () =>
              manualProviderId() ?? providerIdForModel(modelName, props.models());
            const effectiveAuth = (): AuthType | null => {
              const route = primaryRoute();
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
                <PrimaryKeyChip
                  tier={props.tier}
                  provId={provId}
                  effectiveAuth={effectiveAuth}
                  connectedProviders={props.connectedProviders}
                  modelLabel={labelFor(modelName)}
                  modelName={() => modelName}
                  onPinKey={(label) => {
                    const id = provId();
                    if (!id) return;
                    props.onPinKey?.(props.stage.id, id, label, effectiveAuth() ?? undefined);
                  }}
                  disabled={() => props.changingTier() === props.stage.id}
                />
                <Show when={props.setModelParams && props.getModelParams && effectiveAuth()}>
                  <ModelParamsAffordance
                    provider={provId()}
                    authType={effectiveAuth() ?? undefined}
                    model={modelName}
                    slotLabel={labelFor(modelName)}
                    scope={modelParamsScopeForTier(props.stage.id)}
                    agentName={props.agentName()}
                    getParams={props.getModelParams!}
                    setParams={props.setModelParams!}
                    disabled={props.changingTier() === props.stage.id}
                  />
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
              </>
            );
          }}
        />
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

/**
 * Compact inline chip for the primary model row that shows the currently-
 * pinned provider key and lets the user change it without leaving the card.
 * Mirrors the pill on each fallback row so multi-key users see a consistent
 * affordance across primary + fallbacks. Renders nothing when only one key
 * exists for the provider — single-key users never see it.
 */
interface PrimaryKeyChipProps {
  tier: () => TierAssignment | undefined;
  provId: () => string | undefined;
  effectiveAuth: () => AuthType | null;
  connectedProviders: () => RoutingProvider[];
  modelLabel: string;
  modelName: () => string;
  onPinKey: (label: string | null) => void;
  disabled: () => boolean;
}

const PrimaryKeyChip: Component<PrimaryKeyChipProps> = (props) => {
  const keys = () => {
    const id = props.provId();
    const auth = props.effectiveAuth();
    if (!id || !auth || auth === 'local') return [];
    return props
      .connectedProviders()
      .filter(
        (p) =>
          p.provider.toLowerCase() === id.toLowerCase() &&
          p.auth_type === auth &&
          p.is_active &&
          p.has_api_key,
      )
      .slice()
      .sort((a, b) => a.priority - b.priority);
  };

  // The pinned key label now lives inside the route's `keyLabel` field,
  // sitting on whichever route is effective (override > auto). When no
  // pin is set, fall back to the first connected key.
  const pinned = () => {
    const t = props.tier();
    const effective = t?.override_route ?? t?.auto_assigned_route ?? null;
    return effective?.keyLabel ?? null;
  };

  const usedByFallbacks = () =>
    usedKeyLabelsForModelInTier(props.tier(), props.modelName(), 'primary', keys()[0]?.label);

  return (
    <Show when={keys().length > 1}>
      <RouteKeyChip
        keys={keys()}
        currentLabel={pinned()}
        modelLabel={props.modelLabel}
        usedLabels={usedByFallbacks}
        buttonClass="routing-card__key-chip"
        disabled={props.disabled()}
        leadingMargin
        menuMinWidth={140}
        onPick={(label) => {
          if (label) props.onPinKey(label);
        }}
      />
    </Show>
  );
};

export default RoutingTierCard;
