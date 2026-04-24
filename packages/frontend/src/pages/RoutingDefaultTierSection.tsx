import { Show, type Component } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
  TierAssignment,
} from '../services/api.js';
import { DEFAULT_STAGE } from '../services/providers.js';
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
  embedded?: boolean;
}

const RoutingDefaultTierSection: Component<RoutingDefaultTierSectionProps> = (props) => {
  const subtitle = () =>
    'Acts as a safety net and handles requests that complexity routing can\u2019t resolve';

  const card = () => (
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

  if (props.embedded) {
    return (
      <div>
        <Show when={!props.tiersLoading}>
          <span class="routing-section__subtitle" style="margin-bottom: 16px;">
            {subtitle()}
          </span>
        </Show>
        <div class="routing-cards-backdrop">{card()}</div>
      </div>
    );
  }

  return (
    <div class="routing-section routing-section--dimmed">
      <div class="routing-section__header">
        <span class="routing-section__title">Default model</span>
        <Show when={!props.tiersLoading}>
          <span class="routing-section__subtitle">{subtitle()}</span>
        </Show>
      </div>
      {card()}
    </div>
  );
};

export default RoutingDefaultTierSection;
