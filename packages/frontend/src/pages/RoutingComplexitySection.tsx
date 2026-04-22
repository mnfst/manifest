import { createSignal, For, Show, type Component } from 'solid-js';
import { STAGES } from '../services/providers.js';
import { toggleComplexity } from '../services/api.js';
import { toast } from '../services/toast-store.js';
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
  enabled: () => boolean;
  onEnabledChange: (enabled: boolean) => void;
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
}

const RoutingComplexitySection: Component<RoutingComplexitySectionProps> = (props) => {
  const [toggling, setToggling] = createSignal(false);
  const [confirmDisable, setConfirmDisable] = createSignal(false);

  const hasOverridesOrFallbacks = () =>
    props
      .tiers()
      .some(
        (t) =>
          STAGES.some((s) => s.id === t.tier) &&
          (t.override_model !== null || (t.fallback_models?.length ?? 0) > 0),
      );

  const apply = async (next: boolean) => {
    setToggling(true);
    try {
      await toggleComplexity(props.agentName(), next);
      props.onEnabledChange(next);
      toast.success(next ? 'Complexity routing on' : 'Complexity routing off');
    } catch {
      toast.error('Failed to update complexity routing');
    } finally {
      setToggling(false);
    }
  };

  const handleToggle = () => {
    if (toggling()) return;
    const next = !props.enabled();
    if (!next && hasOverridesOrFallbacks()) {
      setConfirmDisable(true);
      return;
    }
    void apply(next);
  };

  return (
    <div class="routing-section">
      <div class="routing-section__header routing-section__header--with-control">
        <div>
          <span class="routing-section__title">Complexity routing</span>
          <span class="routing-section__subtitle">
            Picks a cheap model for easy requests and your best for the rest.
          </span>
        </div>
        <button
          class="routing-switch"
          classList={{ 'routing-switch--on': props.enabled() }}
          onClick={handleToggle}
          disabled={toggling()}
          role="switch"
          aria-checked={props.enabled()}
          aria-label="Route by complexity"
        >
          <span class="routing-switch__label">Route by complexity</span>
          <span class="routing-switch__track">
            <Show
              when={!toggling()}
              fallback={
                <span class="routing-switch__thumb">
                  <span class="spinner" style="width: 10px; height: 10px;" />
                </span>
              }
            >
              <span class="routing-switch__thumb" />
            </Show>
          </span>
        </button>
      </div>

      <Show
        when={props.enabled()}
        fallback={
          <div class="complexity-empty">
            <span class="complexity-empty__title">Complexity routing is off</span>
            <span class="complexity-empty__desc">
              Most requests don't need your top model. Each one gets scored and routed to something
              cheaper when it fits. Can shave up to 70% off your LLM bill.
            </span>
            <button
              class="btn btn--primary btn--sm"
              disabled={toggling()}
              onClick={() => void apply(true)}
            >
              Turn on complexity routing
            </button>
          </div>
        }
      >
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
      </Show>

      <Show when={confirmDisable()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDisable(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmDisable(false);
          }}
        >
          <div
            class="modal-card"
            style="max-width: 440px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complexity-disable-title"
          >
            <h2
              id="complexity-disable-title"
              style="margin: 0 0 12px; font-size: var(--font-size-lg); font-weight: 600;"
            >
              Turn off complexity routing?
            </h2>
            <p style="margin: 0 0 20px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              Your tier picks are kept. The Default model will handle every request that doesn't
              match a task-specific rule.
            </p>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button class="btn btn--outline" onClick={() => setConfirmDisable(false)}>
                Cancel
              </button>
              <button
                class="btn btn--danger"
                disabled={toggling()}
                onClick={() => {
                  setConfirmDisable(false);
                  void apply(false);
                }}
              >
                {toggling() ? <span class="spinner" /> : 'Turn off'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default RoutingComplexitySection;
