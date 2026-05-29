import { Show, type Accessor, type Component, type JSX } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  ModelRoute,
  RequestParamDefaults,
  ResponseMode,
  RoutingProvider,
  TierAssignment,
} from '../services/api.js';
import { formatPerRequestCost } from '../services/formatters.js';
import { providerIdForModel } from '../services/routing-model-utils.js';
import { pricePerM } from '../services/routing-utils.js';
import FallbackList from './FallbackList.js';
import RoutingPrimaryProviderIcon from './RoutingPrimaryProviderIcon.js';
import { createRoutingTierDragDrop } from './routing-tier-drag-drop.js';

export interface RoutingTierModelSlotsProps {
  agentName: string;
  tierId: string;
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  connectedProviders: RoutingProvider[];
  primaryModel: Accessor<string | null>;
  primaryRoute: Accessor<ModelRoute | null>;
  fallbacks: Accessor<string[]>;
  fallbackRoutes: Accessor<ModelRoute[] | null>;
  responseMode: Accessor<ResponseMode>;
  providerIdForPrimary: Accessor<string | undefined>;
  effectiveAuthForPrimary: Accessor<AuthType | null>;
  primaryLabel: (model: string) => string;
  primarySkipped: Accessor<boolean>;
  onFallbackUpdate: (fallbacks: string[], routes?: ModelRoute[] | null) => void;
  onPrimaryOverride: (
    model: string,
    provider: string,
    authType?: AuthType,
    keyLabel?: string,
  ) => Promise<void>;
  persistFallbacks: (
    agentName: string,
    tier: string,
    models: string[],
    routes?: ModelRoute[],
  ) => Promise<unknown>;
  persistClearFallbacks?: (agentName: string, tier: string) => Promise<unknown>;
  onAddFallback: () => void;
  addingFallback?: boolean;
  modelParamsScope: string;
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
  tierData?: Accessor<TierAssignment | undefined>;
  showSwappingSkeleton?: Accessor<boolean>;
  renderPrimaryExtension?: (model: string) => JSX.Element;
  renderPrimaryActions: (model: string) => JSX.Element;
  onPrimaryChipClick?: (model: string) => void;
}

const RoutingTierModelSlots: Component<RoutingTierModelSlotsProps> = (props) => {
  const modelInfo = (modelName: string): AvailableModel | undefined =>
    props.models.find((m) => m.model_name === modelName) ??
    props.models.find((m) => m.model_name.startsWith(modelName + '-'));

  const priceLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return '';
    return `${pricePerM(Number(info.input_price_per_token ?? 0))} in · ${pricePerM(Number(info.output_price_per_token ?? 0))} out per 1M`;
  };

  const dragDrop = createRoutingTierDragDrop({
    agentName: () => props.agentName,
    tierId: () => props.tierId,
    getPrimaryModel: props.primaryModel,
    getPrimaryRoute: props.primaryRoute,
    getFallbacks: props.fallbacks,
    getFallbackRoutes: props.fallbackRoutes,
    onFallbackUpdate: (fallbacks, routes) => props.onFallbackUpdate(fallbacks, routes),
    onPrimaryOverride: props.onPrimaryOverride,
    persistFallbacks: props.persistFallbacks,
    resolveProviderForModel: (model) => {
      const route = props.primaryRoute();
      if (route?.model === model && route.provider) {
        return route.provider.toLowerCase();
      }
      return providerIdForModel(model, props.models);
    },
  });

  const isSwapping = () =>
    dragDrop.swappingFbIndex() !== null || (props.showSwappingSkeleton?.() ?? false);

  return (
    <>
      <div class="routing-card__body">
        <Show when={props.primaryModel()} fallback={null}>
          {(modelName) => {
            const provId = props.providerIdForPrimary;
            return (
              <Show
                when={!isSwapping()}
                fallback={
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
                }
              >
                <div
                  class="routing-card__model-chip"
                  classList={{
                    'routing-card__model-chip--dragging': dragDrop.primaryDragging(),
                    'routing-card__model-chip--drop-target': dragDrop.primaryDropTarget(),
                    'routing-card__model-chip--skipped': props.primarySkipped(),
                  }}
                  title={props.primarySkipped() ? 'Skipped while Stream mode is active' : undefined}
                  draggable={true}
                  onDragStart={dragDrop.handlePrimaryDragStart}
                  onDragEnd={dragDrop.handlePrimaryDragEnd}
                  onDragOver={dragDrop.handlePrimaryDragOver}
                  onDragLeave={dragDrop.handlePrimaryDragLeave}
                  onDrop={dragDrop.handlePrimaryDrop}
                  onClick={() => props.onPrimaryChipClick?.(modelName())}
                >
                  <div class="routing-card__chip-main">
                    <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                      <div class="routing-card__override">
                        <RoutingPrimaryProviderIcon
                          providerId={provId}
                          modelName={modelName}
                          customProviders={props.customProviders}
                          effectiveAuth={props.effectiveAuthForPrimary}
                        />
                        <span class="routing-card__main">{props.primaryLabel(modelName())}</span>
                        {props.renderPrimaryExtension?.(modelName())}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                      {props.renderPrimaryActions(modelName())}
                    </div>
                  </div>
                  <div class="routing-card__chip-footer">
                    <Show
                      when={props.effectiveAuthForPrimary() !== 'subscription'}
                      fallback={
                        <span class="routing-card__chip-meta">
                          <span class="routing-card__chip-price">
                            {formatPerRequestCost(modelInfo(modelName())?.cost_per_request) ??
                              'Included in subscription'}
                          </span>
                          <Show when={props.primarySkipped()}>
                            <span class="routing-card__skipped-badge">Skipped in Stream</span>
                          </Show>
                        </span>
                      }
                    >
                      <span class="routing-card__chip-meta">
                        <span class="routing-card__chip-price">{priceLabel(modelName())}</span>
                        <Show when={props.primarySkipped()}>
                          <span class="routing-card__skipped-badge">Skipped in Stream</span>
                        </Show>
                      </span>
                    </Show>
                  </div>
                </div>
              </Show>
            );
          }}
        </Show>
      </div>
      <Show when={props.primaryModel()}>
        <div class="routing-card__right">
          <FallbackList
            agentName={props.agentName}
            tier={props.tierId}
            tierData={props.tierData}
            fallbacks={props.fallbacks()}
            fallbackRoutes={props.fallbackRoutes()}
            models={props.models}
            customProviders={props.customProviders}
            connectedProviders={props.connectedProviders}
            onUpdate={(updatedFallbacks, updatedRoutes) =>
              props.onFallbackUpdate(updatedFallbacks, updatedRoutes)
            }
            onAddFallback={props.onAddFallback}
            adding={props.addingFallback}
            primaryDragging={dragDrop.primaryDragging()}
            onPrimaryDropAtSlot={dragDrop.handlePrimaryDropAtSlot}
            onFallbackDragStart={(index) => dragDrop.setFallbackDragging(index)}
            onFallbackDragEnd={() => dragDrop.setFallbackDragging(null)}
            persistFallbacks={props.persistFallbacks}
            persistClearFallbacks={props.persistClearFallbacks}
            getModelParams={props.getModelParams}
            setModelParams={props.setModelParams}
            swappingIndex={dragDrop.swappingFbIndex()}
            modelParamsScope={props.modelParamsScope}
            responseMode={props.responseMode()}
          />
        </div>
      </Show>
    </>
  );
};

export default RoutingTierModelSlots;
