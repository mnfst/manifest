import { For, Show, type Component } from 'solid-js';
import { STAGES } from '../services/providers.js';
import RoutingTierCard from './RoutingTierCard.js';
import type {
  TierAssignment,
  AvailableModel,
  AuthType,
  RoutingProvider,
  CustomProviderData,
} from '../services/api.js';

export interface RoutingComplexitySectionProps {
  agentName: () => string;
  tiers: () => TierAssignment[];
  models: () => AvailableModel[];
  customProviders: () => CustomProviderData[];
  activeProviders: () => RoutingProvider[];
  connectedProviders: () => RoutingProvider[];
  tiersLoading: boolean;
  changingTier: () => string | null;
  resettingTier: () => string | null;
  resettingAll: () => boolean;
  addingFallback: () => string | null;
  onDropdownOpen: (tierId: string) => void;
  onOverride: (tierId: string, model: string, provider: string, authType?: AuthType) => void;
  onReset: (tierId: string) => void;
  onFallbackUpdate: (tierId: string, fallbacks: string[]) => void;
  onAddFallback: (tierId: string) => void;
  getFallbacksFor: (tierId: string) => string[];
  getTier: (tierId: string) => TierAssignment | undefined;
  complexityEnabled: () => boolean;
  togglingComplexity: () => boolean;
  onToggleComplexity: () => void;
  embedded?: boolean;
}

const RoutingComplexitySection: Component<RoutingComplexitySectionProps> = (props) => {
  const tierCards = () => (
    <div class="routing-cards">
      <For each={STAGES}>
        {(stage) => (
          <RoutingTierCard
            stage={stage}
            tier={() => props.getTier(stage.id)}
            models={props.models}
            customProviders={props.customProviders}
            activeProviders={props.activeProviders}
            tiersLoading={props.tiersLoading}
            changingTier={props.changingTier}
            resettingTier={props.resettingTier}
            resettingAll={props.resettingAll}
            addingFallback={props.addingFallback}
            agentName={props.agentName}
            onDropdownOpen={props.onDropdownOpen}
            onOverride={props.onOverride}
            onReset={props.onReset}
            onFallbackUpdate={props.onFallbackUpdate}
            onAddFallback={props.onAddFallback}
            getFallbacksFor={props.getFallbacksFor}
            connectedProviders={props.connectedProviders}
          />
        )}
      </For>
    </div>
  );

  const toggle = () => (
    <button
      class="routing-switch"
      classList={{ 'routing-switch--on': props.complexityEnabled() }}
      disabled={props.togglingComplexity()}
      onClick={() => props.onToggleComplexity()}
      aria-pressed={props.complexityEnabled()}
    >
      <span class="routing-switch__label">
        {props.complexityEnabled() ? 'Enabled' : 'Disabled'}
      </span>
      <span class="routing-switch__track">
        <span class="routing-switch__thumb" />
      </span>
    </button>
  );

  const emptyState = () => (
    <div class="complexity-empty">
      <span class="complexity-empty__title">Complexity routing is off</span>
      <span class="complexity-empty__desc">
        All requests go through the default tier. Enable complexity routing to score each request
        and route it to a matching tier.
      </span>
    </div>
  );

  if (props.embedded) {
    return (
      <div>
        <div
          class="routing-section__header routing-section__header--with-control"
          style="margin-bottom: 16px;"
        >
          <span class="routing-section__subtitle">
            Analyzes the complexity of each request on the fly and routes it to the matching tier.
          </span>
          {toggle()}
        </div>
        <Show when={props.complexityEnabled()} fallback={emptyState()}>
          {tierCards()}
        </Show>
      </div>
    );
  }

  return (
    <div class="routing-section">
      <div class="routing-section__header routing-section__header--with-control">
        <div>
          <span class="routing-section__title">Complexity routing</span>
          <span class="routing-section__subtitle">
            Analyzes the complexity of each request on the fly and routes it to the matching tier.
          </span>
        </div>
        {toggle()}
      </div>
      <Show when={props.complexityEnabled()} fallback={emptyState()}>
        {tierCards()}
      </Show>
    </div>
  );
};

export default RoutingComplexitySection;
