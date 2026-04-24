import { For, type Component } from 'solid-js';
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

  if (props.embedded) {
    return (
      <div>
        <div class="routing-section__header" style="margin-bottom: 16px;">
          <span class="routing-section__subtitle">
            Analyzes the complexity of each request on the fly and routes it to the matching tier.
          </span>
        </div>
        {tierCards()}
      </div>
    );
  }

  return (
    <div class="routing-section">
      <div class="routing-section__header">
        <span class="routing-section__title">Complexity routing</span>
        <span class="routing-section__subtitle">
          Analyzes the complexity of each request on the fly and routes it to the matching tier.
        </span>
      </div>
      {tierCards()}
    </div>
  );
};

export default RoutingComplexitySection;
