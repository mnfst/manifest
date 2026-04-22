import { createResource, createSignal, For, Show, type Accessor, type Component } from 'solid-js';
import HeaderTierCard from '../components/HeaderTierCard.js';
import HeaderTierModal from '../components/HeaderTierModal.js';
import HeaderTierSnippetModal from '../components/HeaderTierSnippetModal.js';
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
  // Modal state. `null` = closed, `'new'` = create flow, otherwise the tier
  // being edited. The `<Show keyed>` below remounts the modal on identity
  // change, so the modal can read its `editing` prop once at setup.
  const [modalTier, setModalTier] = createSignal<HeaderTier | 'new' | null>(null);
  // After a tier is freshly created, auto-open the SDK snippet modal once so
  // users immediately learn how to send the matching header from their app.
  const [snippetTier, setSnippetTier] = createSignal<HeaderTier | null>(null);

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
      <div class="routing-section__header routing-section__header--header-tiers">
        <div>
          <h2 class="routing-section__title">Custom tiers</h2>
          <p class="routing-section__subtitle">
            Route requests by HTTP header. Custom tiers run before generalist and specific tiers.
          </p>
        </div>
        <button
          type="button"
          class="btn btn--outline routing-section__cta"
          onClick={() => setModalTier('new')}
        >
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
        <div class="routing-cards header-tier-list">
          <For each={tiers()}>
            {(tier, idx) => (
              <HeaderTierCard
                agentName={props.agentName()}
                tier={tier}
                ordinal={idx()}
                models={props.models()}
                customProviders={props.customProviders()}
                connectedProviders={props.connectedProviders()}
                onOverride={(m, p, a) => handleOverride(tier.id, m, p, a)}
                onReset={() => handleReset(tier.id)}
                onDelete={() => handleDelete(tier.id)}
                onEdit={() => setModalTier(tier)}
                onFallbacksUpdate={() => refetch()}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={modalTier()} keyed>
        {(state) => (
          <HeaderTierModal
            agentName={props.agentName()}
            existingTiers={tiers()}
            editing={state === 'new' ? undefined : state}
            onClose={() => setModalTier(null)}
            onSaved={(saved) => {
              const wasCreate = state === 'new';
              setModalTier(null);
              refetch();
              if (wasCreate) setSnippetTier(saved);
            }}
          />
        )}
      </Show>

      <Show when={snippetTier()} keyed>
        {(t) => (
          <HeaderTierSnippetModal
            agentName={props.agentName()}
            tier={t}
            onClose={() => setSnippetTier(null)}
          />
        )}
      </Show>
    </div>
  );
};

export default RoutingHeaderTiersSection;
