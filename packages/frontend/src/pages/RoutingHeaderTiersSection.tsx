import { createResource, createSignal, For, Show, type Accessor, type Component } from 'solid-js';
import HeaderTierCard from '../components/HeaderTierCard.js';
import CreateHeaderTierModal from '../components/CreateHeaderTierModal.js';
import {
  listHeaderTiers,
  deleteHeaderTier,
  overrideHeaderTier,
  resetHeaderTier,
  type HeaderTier,
} from '../services/api/header-tiers.js';
import type {
  AvailableModel,
  AuthType,
  CustomProviderData,
  RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import '../styles/routing-header-tiers.css';

interface Props {
  agentName: Accessor<string>;
  models: Accessor<AvailableModel[]>;
  customProviders: Accessor<CustomProviderData[]>;
  connectedProviders: Accessor<RoutingProvider[]>;
}

const RoutingHeaderTiersSection: Component<Props> = (props) => {
  const [tiersRes, { refetch }] = createResource(props.agentName, (name) =>
    listHeaderTiers(name).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to load custom tiers');
      return [] as HeaderTier[];
    }),
  );
  const [creating, setCreating] = createSignal(false);

  const tiers = (): HeaderTier[] => tiersRes() ?? [];

  const handleOverride = async (
    id: string,
    model: string,
    provider: string,
    authType?: AuthType,
  ): Promise<void> => {
    try {
      await overrideHeaderTier(props.agentName(), id, model, provider, authType);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tier');
    }
  };

  const handleReset = async (id: string): Promise<void> => {
    try {
      await resetHeaderTier(props.agentName(), id);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset tier');
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteHeaderTier(props.agentName(), id);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tier');
    }
  };

  return (
    <div class="routing-section routing-section--header-tiers">
      <div class="routing-section__header">
        <div>
          <h2 class="routing-section__title">Custom tiers</h2>
          <p class="routing-section__subtitle">
            Route requests by HTTP header. Custom tiers run before generalist and specific tiers.
          </p>
        </div>
        <button type="button" class="routing-section__cta" onClick={() => setCreating(true)}>
          + Create custom tier
        </button>
      </div>

      <Show
        when={tiers().length > 0}
        fallback={
          <div class="routing-section__empty">
            <div class="routing-section__empty-title">No custom tier yet</div>
            <div class="routing-section__empty-desc">
              Create a tier triggered by a header like <code>x-manifest-tier: premium</code> to
              force specific requests to a chosen model.
            </div>
          </div>
        }
      >
        <div class="header-tier-list">
          <For each={tiers()}>
            {(tier, idx) => (
              <HeaderTierCard
                tier={tier}
                ordinal={idx()}
                models={props.models()}
                customProviders={props.customProviders()}
                connectedProviders={props.connectedProviders()}
                onOverride={(m, p, a) => handleOverride(tier.id, m, p, a)}
                onReset={() => handleReset(tier.id)}
                onDelete={() => handleDelete(tier.id)}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={creating()}>
        <CreateHeaderTierModal
          agentName={props.agentName()}
          existingTiers={tiers()}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refetch();
          }}
        />
      </Show>
    </div>
  );
};

export default RoutingHeaderTiersSection;
