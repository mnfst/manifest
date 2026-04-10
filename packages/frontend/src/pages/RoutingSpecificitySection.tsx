import { createSignal, For, Show, type Component, type Accessor } from 'solid-js';
import { toast } from '../services/toast-store.js';
import {
  toggleSpecificity,
  setSpecificityFallbacks,
  clearSpecificityFallbacks,
} from '../services/api.js';
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
  refetchSpecificity?: () => Promise<void>;
}

function toTierAssignment(a: SpecificityAssignment | undefined): TierAssignment | undefined {
  if (!a) return undefined;
  return { ...a, tier: a.category };
}

const RoutingSpecificitySection: Component<RoutingSpecificitySectionProps> = (props) => {
  const [toggling, setToggling] = createSignal<string | null>(null);
  const [showModal, setShowModal] = createSignal(false);

  const getAssignment = (category: string) =>
    props.assignments()?.find((a) => a.category === category);

  const isActive = (category: string) => getAssignment(category)?.is_active ?? false;

  const hasAnyActive = () => SPECIFICITY_STAGES.some((s) => isActive(s.id));

  const activeTiers = () => SPECIFICITY_STAGES.filter((s) => isActive(s.id));

  const handleToggle = async (category: string, label: string, active: boolean) => {
    setToggling(category);
    try {
      await toggleSpecificity(props.agentName(), category, active);
      if (showModal() && props.refetchSpecificity) {
        await props.refetchSpecificity();
      } else {
        await props.refetchAll();
      }
      toast.success(`${active ? 'Enabled' : 'Disabled'} ${label} tier`);
    } catch {
      toast.error('Failed to update specific tier');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div class="routing-section">
      <div class="routing-section__header specificity-header">
        <div class="specificity-header__left">
          <span class="routing-section__title">Specific tiers</span>
          <span class="routing-section__subtitle">
            Specific tiers override generalist routing when a request matches a specific task type.
            Enable a tier and assign the best model for that job.
          </span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => setShowModal(true)}>
          {hasAnyActive() ? 'Manage specific tiers' : 'Enable specific tiers'}
        </button>
      </div>

      <Show
        when={activeTiers().length > 0}
        fallback={
          <div class="specificity-empty">
            <span class="specificity-empty__title">No specific tier yet</span>
            <span class="specificity-empty__desc">
              Enable specific tiers to route specialized tasks to dedicated models.
            </span>
            <button class="btn btn--primary btn--sm" onClick={() => setShowModal(true)}>
              Enable specific tiers
            </button>
          </div>
        }
      >
        <div class="specificity-cards">
          <For each={activeTiers()}>
            {(stage) => (
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
                persistFallbacks={(_agentName, category, models) =>
                  setSpecificityFallbacks(_agentName, category, models)
                }
                persistClearFallbacks={(_agentName, category) =>
                  clearSpecificityFallbacks(_agentName, category)
                }
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={showModal()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowModal(false);
          }}
        >
          <div
            class="modal-card specificity-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="specificity-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="specificity-modal-title" class="specificity-modal__title">
              Manage specific tiers
            </h2>
            <p class="specificity-modal__desc">
              Enable specific tiers to route specialized tasks to dedicated models.
            </p>
            <div class="specificity-modal__list">
              <For each={SPECIFICITY_STAGES}>
                {(stage) => {
                  const active = () => isActive(stage.id);
                  const loading = () => toggling() === stage.id;
                  return (
                    <div class="specificity-modal__row">
                      <div class="specificity-modal__info">
                        <span class="specificity-modal__name">{stage.label}</span>
                        <span class="specificity-modal__stage-desc">{stage.desc}</span>
                      </div>
                      <button
                        class="specificity-modal__toggle"
                        classList={{
                          'specificity-modal__toggle--on': active(),
                        }}
                        disabled={loading()}
                        onClick={() => handleToggle(stage.id, stage.label, !active())}
                        aria-label={`${active() ? 'Disable' : 'Enable'} ${stage.label}`}
                      >
                        <Show
                          when={loading()}
                          fallback={<span class="specificity-modal__toggle-thumb" />}
                        >
                          <span class="specificity-modal__toggle-thumb">
                            <span class="spinner" style="width: 10px; height: 10px;" />
                          </span>
                        </Show>
                      </button>
                    </div>
                  );
                }}
              </For>
            </div>
            <div class="specificity-modal__footer">
              <button class="btn btn--primary" onClick={() => setShowModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default RoutingSpecificitySection;
