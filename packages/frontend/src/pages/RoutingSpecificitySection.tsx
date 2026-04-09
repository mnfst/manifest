import { createSignal, For, Show, type Component, type Accessor } from 'solid-js';
import { toast } from '../services/toast-store.js';
import { toggleSpecificity } from '../services/api.js';
import { SPECIFICITY_STAGES } from '../services/providers.js';
import RoutingTierCard from './RoutingTierCard.js';
import type {
  SpecificityAssignment,
  TierAssignment,
  AvailableModel,
  AuthType,
  RoutingProvider,
  CustomProviderData,
} from '../services/api.js';
import '../styles/routing-specificity.css';

export interface RoutingSpecificitySectionProps {
  agentName: () => string;
  assignments: Accessor<SpecificityAssignment[] | undefined>;
  models: () => AvailableModel[];
  customProviders: () => CustomProviderData[];
  activeProviders: () => RoutingProvider[];
  connectedProviders: () => RoutingProvider[];
  changingTier: () => string | null;
  resettingTier: () => string | null;
  resettingAll: () => boolean;
  addingFallback: () => string | null;
  onDropdownOpen: (category: string) => void;
  onOverride: (category: string, model: string, provider: string, authType?: AuthType) => void;
  onReset: (category: string) => void;
  onFallbackUpdate: (category: string, fallbacks: string[]) => void;
  onAddFallback: (category: string) => void;
  refetchAll: () => Promise<void>;
}

function toTierAssignment(a: SpecificityAssignment | undefined): TierAssignment | undefined {
  if (!a) return undefined;
  return { ...a, tier: a.category };
}

const RoutingSpecificitySection: Component<RoutingSpecificitySectionProps> = (props) => {
  const [toggling, setToggling] = createSignal<string | null>(null);

  const getAssignment = (category: string) =>
    props.assignments()?.find((a) => a.category === category);

  const isActive = (category: string) => getAssignment(category)?.is_active ?? false;

  const handleToggle = async (category: string, label: string, active: boolean) => {
    setToggling(category);
    try {
      await toggleSpecificity(props.agentName(), category, active);
      await props.refetchAll();
      toast.success(`${active ? 'Enabled' : 'Disabled'} ${label} routing`);
    } catch {
      toast.error('Failed to update specificity routing');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div class="routing-section">
      <div class="routing-section__header">
        <span class="routing-section__title">By task type</span>
        <span class="routing-section__subtitle">
          When enabled, these take priority over complexity tiers
        </span>
      </div>

      <div class="specificity-cards">
        <For each={SPECIFICITY_STAGES}>
          {(stage) => (
            <Show
              when={isActive(stage.id)}
              fallback={
                <div class="routing-card routing-card--disabled">
                  <div class="routing-card__header">
                    <span class="routing-card__tier">{stage.label}</span>
                  </div>
                  <div class="routing-card__body">
                    <span class="routing-card__disabled-text">Disabled</span>
                    <span class="routing-card__disabled-desc">{stage.desc}</span>
                  </div>
                  <div class="routing-card__right">
                    <div class="routing-card__actions">
                      <button
                        class="routing-action"
                        disabled={toggling() === stage.id}
                        onClick={() => handleToggle(stage.id, stage.label, true)}
                      >
                        {toggling() === stage.id ? <span class="spinner" /> : 'Enable'}
                      </button>
                    </div>
                  </div>
                </div>
              }
            >
              <div class="specificity-card-wrapper">
                <RoutingTierCard
                  stage={stage}
                  tier={() => toTierAssignment(getAssignment(stage.id))}
                  models={props.models}
                  customProviders={props.customProviders}
                  activeProviders={props.activeProviders}
                  tiersLoading={false}
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
                  getFallbacksFor={(cat) => getAssignment(cat)?.fallback_models ?? []}
                  connectedProviders={props.connectedProviders}
                />
                <button
                  class="specificity-disable-btn"
                  disabled={toggling() === stage.id}
                  onClick={() => handleToggle(stage.id, stage.label, false)}
                >
                  {toggling() === stage.id ? 'Disabling...' : 'Disable'}
                </button>
              </div>
            </Show>
          )}
        </For>

        <a
          class="routing-card routing-card--cta"
          href="https://github.com/mnfst/manifest/discussions/948"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div class="routing-card__header">
            <span class="routing-card__tier">+ Request a tier</span>
          </div>
          <div class="routing-card__body">
            <span class="routing-card__disabled-desc">
              Need a task type we don't cover? Let us know.
            </span>
          </div>
        </a>
      </div>
    </div>
  );
};

export default RoutingSpecificitySection;
