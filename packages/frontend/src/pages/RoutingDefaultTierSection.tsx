import { For, Show, type Component } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
  TierAssignment,
} from '../services/api.js';
import { DEFAULT_STAGE, STAGES } from '../services/providers.js';
import RoutingTierCard from './RoutingTierCard.js';

export interface RoutingDefaultTierSectionProps {
  agentName: () => string;
  tier: () => TierAssignment | undefined;
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

const RoutingDefaultTierSection: Component<RoutingDefaultTierSectionProps> = (props) => {
  const defaultCard = () => (
    <div
      class="routing-cards"
      classList={{
        'routing-cards--wide': !props.embedded,
        'routing-cards--centered': !!props.embedded,
      }}
    >
      <RoutingTierCard
        stage={DEFAULT_STAGE}
        tier={props.tier}
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
    </div>
  );

  const complexityCards = () => (
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

  const switchButton = () => (
    <button
      class="routing-switch"
      classList={{ 'routing-switch--on': props.complexityEnabled() }}
      disabled={props.togglingComplexity()}
      onClick={() => props.onToggleComplexity()}
    >
      <span class="routing-switch__label">Route by complexity</span>
      <span class="routing-switch__track">
        <span class="routing-switch__thumb" />
      </span>
    </button>
  );

  const subtitle = () =>
    props.complexityEnabled()
      ? 'Analyzes the complexity of each request on the fly and routes it to the matching tier.'
      : 'Pick one model and up to 5 fallbacks as your default routing.';

  if (props.embedded) {
    return (
      <div>
        <div
          class="routing-section__header routing-section__header--with-control"
          style="margin-bottom: 16px;"
        >
          <span class="routing-section__subtitle">{subtitle()}</span>
          {switchButton()}
        </div>
        <Show
          when={props.complexityEnabled()}
          fallback={<div class="routing-cards-backdrop">{defaultCard()}</div>}
        >
          {complexityCards()}
        </Show>
      </div>
    );
  }

  return (
    <div class="routing-section">
      <div class="routing-section__header routing-section__header--with-control">
        <div>
          <span class="routing-section__title">Default routing</span>
          <span class="routing-section__subtitle">{subtitle()}</span>
        </div>
        {switchButton()}
      </div>
      <Show when={props.complexityEnabled()} fallback={defaultCard()}>
        {complexityCards()}
      </Show>
    </div>
  );
};

export default RoutingDefaultTierSection;
