import { For, Show, type Component } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import type { StageDef } from '../services/providers.js';
import { getModelLabel } from '../services/provider-utils.js';
import { providerIcon } from '../components/ProviderIcon.js';
import { authBadgeFor } from '../components/AuthBadge.js';
import { pricePerM, resolveProviderId, inferProviderFromModel } from '../services/routing-utils.js';
import FallbackList from '../components/FallbackList.js';
import type {
  TierAssignment,
  AvailableModel,
  AuthType,
  RoutingProvider,
  CustomProviderData,
} from '../services/api.js';

function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m =
    apiModels.find((x) => x.model_name === model) ??
    apiModels.find((x) => x.model_name.startsWith(model + '-'));
  if (m) {
    const prefixId = inferProviderFromModel(m.model_name);
    if (prefixId && PROVIDERS.find((p) => p.id === prefixId)) return prefixId;
    return resolveProviderId(m.provider) ?? prefixId;
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
  onOverride: (tierId: string, model: string, authType?: AuthType) => void;
  onReset: (tierId: string) => void;
  onFallbackUpdate: (tierId: string, fallbacks: string[]) => void;
  onAddFallback: (tierId: string) => void;
  getFallbacksFor: (tierId: string) => string[];
  connectedProviders: () => RoutingProvider[];
}

const effectiveModel = (t: TierAssignment): string | null =>
  t.override_model ?? t.auto_assigned_model;

const RoutingTierCard: Component<RoutingTierCardProps> = (props) => {
  const eff = () => {
    const t = props.tier();
    return t ? effectiveModel(t) : null;
  };
  const isManual = () =>
    props.tier()?.override_model !== null && props.tier()?.override_model !== undefined;

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
        <span class="routing-card__desc">{props.stage.desc}</span>
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
          <Show
            when={eff()}
            fallback={
              <div class="routing-card__empty">
                <span class="routing-card__empty-text">No model available</span>
                <button
                  class="routing-card__empty-link"
                  onClick={() => props.onDropdownOpen(props.stage.id)}
                >
                  Select model
                </button>
              </div>
            }
          >
            {(modelName) => {
              const provId = () => providerIdForModel(modelName(), props.models());
              const effectiveAuth = (): AuthType | null => {
                const t = props.tier();
                if (t?.override_auth_type) return t.override_auth_type;
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
                      <>
                        <div class="routing-card__override">
                          <div
                            class="skeleton skeleton--text"
                            style="width: 140px; height: 14px;"
                          />
                        </div>
                        <div
                          class="skeleton skeleton--text"
                          style="width: 180px; height: 12px; margin-top: 6px;"
                        />
                      </>
                    }
                  >
                    <div class="routing-card__override">
                      {(() => {
                        const pid = provId();
                        if (pid?.startsWith('custom:')) {
                          const cp = props.customProviders()?.find((c) => `custom:${c.id}` === pid);
                          const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                          return (
                            <span class="routing-card__override-icon">
                              <span
                                class="provider-card__logo-letter"
                                style={{
                                  background: 'var(--custom-provider-color)',
                                  width: '16px',
                                  height: '16px',
                                  'font-size': '9px',
                                  'border-radius': '50%',
                                }}
                              >
                                {letter}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <Show when={pid}>
                            {(p) => (
                              <span class="routing-card__override-icon">
                                {providerIcon(p(), 16)}
                                {authBadgeFor(effectiveAuth(), 12)}
                              </span>
                            )}
                          </Show>
                        );
                      })()}
                      <span class="routing-card__main">{labelFor(modelName())}</span>
                      <Show when={!isManual()}>
                        <span class="routing-card__auto-tag">auto</span>
                      </Show>
                    </div>
                    <Show
                      when={effectiveAuth() !== 'subscription'}
                      fallback={
                        <span class="routing-card__sub routing-card__sub--subscription">
                          Included in subscription
                        </span>
                      }
                    >
                      <span class="routing-card__sub">{priceLabel(modelName())}</span>
                    </Show>
                  </Show>
                </>
              );
            }}
          </Show>
        </div>
        <Show when={eff()}>
          <div class="routing-card__right">
            <div class="routing-card__actions">
              <button
                class="routing-action"
                onClick={() => props.onDropdownOpen(props.stage.id)}
                disabled={props.changingTier() === props.stage.id}
              >
                <Show
                  when={props.changingTier() !== props.stage.id}
                  fallback={<span class="spinner" />}
                >
                  Change
                </Show>
              </button>
              <Show when={isManual()}>
                <button
                  class="routing-action"
                  onClick={() => props.onReset(props.stage.id)}
                  disabled={props.resettingTier() === props.stage.id || props.resettingAll()}
                >
                  {props.resettingTier() === props.stage.id ? <span class="spinner" /> : 'Reset'}
                </button>
              </Show>
            </div>
            <FallbackList
              agentName={props.agentName()}
              tier={props.stage.id}
              fallbacks={props.getFallbacksFor(props.stage.id)}
              models={props.models()}
              customProviders={props.customProviders()}
              connectedProviders={props.activeProviders()}
              onUpdate={(updatedFallbacks) =>
                props.onFallbackUpdate(props.stage.id, updatedFallbacks)
              }
              onAddFallback={() => props.onAddFallback(props.stage.id)}
              adding={props.addingFallback() === props.stage.id}
            />
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default RoutingTierCard;
