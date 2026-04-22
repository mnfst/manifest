import { Show, type Component } from 'solid-js';
import { DEFAULT_STAGE } from '../services/providers.js';
import RoutingTierCard from './RoutingTierCard.js';
import type {
  TierAssignment,
  AvailableModel,
  AuthType,
  RoutingProvider,
  CustomProviderData,
} from '../services/api.js';

export interface RoutingDefaultTierSectionProps {
  agentName: () => string;
  tier: () => TierAssignment | undefined;
  complexityEnabled: () => boolean;
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
}

const RoutingDefaultTierSection: Component<RoutingDefaultTierSectionProps> = (props) => {
  const subtitle = () =>
    props.complexityEnabled()
      ? 'Final fallback after complexity and task-specific rules.'
      : 'Handles every request.';

  return (
    <div class="routing-section">
      <div class="routing-section__header">
        <span class="routing-section__title">Default model</span>
        <Show when={!props.tiersLoading}>
          <span class="routing-section__subtitle">{subtitle()}</span>
        </Show>
      </div>
      <div class="routing-cards routing-cards--wide">
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
    </div>
  );
};

export default RoutingDefaultTierSection;
