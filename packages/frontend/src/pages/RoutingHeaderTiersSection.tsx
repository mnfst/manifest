import { createResource, createSignal, For, Show, type Accessor, type Component } from 'solid-js';
import HeaderTierCard from '../components/HeaderTierCard.js';
import HeaderTierModal from '../components/HeaderTierModal.js';
import HeaderTierSnippetModal from '../components/HeaderTierSnippetModal.js';
import {
  listHeaderTiers,
  deleteHeaderTier,
  overrideHeaderTier,
  toggleHeaderTier,
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

export interface RoutingHeaderTiersSectionProps {
  agentName: Accessor<string>;
  models: Accessor<AvailableModel[]>;
  customProviders: Accessor<CustomProviderData[]>;
  connectedProviders: Accessor<RoutingProvider[]>;
  externalTiers?: Accessor<HeaderTier[] | undefined>;
  externalRefetch?: () => void;
  embedded?: boolean;
}

type Props = RoutingHeaderTiersSectionProps;

const RoutingHeaderTiersSection: Component<Props> = (props) => {
  const [internalTiersRes, { refetch: internalRefetch }] = createResource(
    () => (props.externalTiers ? false : props.agentName()),
    (name) =>
      listHeaderTiers(name as string).catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load custom tiers');
        return [] as HeaderTier[];
      }),
  );

  const refetch = () => {
    if (props.externalRefetch) props.externalRefetch();
    else void internalRefetch();
  };

  // Manage modal: lists all tiers. `null` = closed.
  const [manageOpen, setManageOpen] = createSignal(false);
  // Create/edit modal: `null` = closed, `'new'` = create, otherwise editing.
  const [modalTier, setModalTier] = createSignal<HeaderTier | 'new' | null>(null);
  // When editing from manage modal, track so we can go back.
  const [editFromManage, setEditFromManage] = createSignal(false);
  // After a tier is freshly created, auto-open the SDK snippet modal.
  const [snippetTier, setSnippetTier] = createSignal<HeaderTier | null>(null);
  // Which tier is currently being toggled (loading state).
  const [toggling, setToggling] = createSignal<string | null>(null);

  const tiers = (): HeaderTier[] =>
    (props.externalTiers ? props.externalTiers() : internalTiersRes()) ?? [];
  const enabledTiers = (): HeaderTier[] => tiers().filter((t) => t.enabled);

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

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteHeaderTier(props.agentName(), id);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tier');
    }
  };

  const handleToggle = async (id: string, enabled: boolean): Promise<void> => {
    setToggling(id);
    try {
      await toggleHeaderTier(props.agentName(), id, enabled);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle tier');
    } finally {
      setToggling(null);
    }
  };

  const openCreateOrManage = () => {
    if (tiers().length > 0) {
      setManageOpen(true);
    } else {
      setModalTier('new');
    }
  };

  const openEditFromManage = (tier: HeaderTier) => {
    setManageOpen(false);
    setEditFromManage(true);
    setModalTier(tier);
  };

  const handleBackToManage = () => {
    setModalTier(null);
    setEditFromManage(false);
    setManageOpen(true);
  };

  const handleDeleteFromEdit = async (id: string) => {
    await handleDelete(id);
    setModalTier(null);
    setEditFromManage(false);
    setManageOpen(true);
  };

  const manageButton = () => (
    <button
      type="button"
      class="btn btn--primary btn--sm routing-section__cta"
      onClick={openCreateOrManage}
    >
      {tiers().length > 0 ? 'Manage custom routing' : 'Create custom tier'}
    </button>
  );

  const content = () => (
    <>
      <Show
        when={enabledTiers().length > 0}
        fallback={
          <div class="routing-section__empty">
            <div class="routing-section__empty-title">No custom tier yet</div>
            <div class="routing-section__empty-desc">
              Create a tier triggered by a header like <code>x-manifest-tier: premium</code> to
              force specific requests to a chosen model.
            </div>
            <button type="button" class="btn btn--primary btn--sm" onClick={openCreateOrManage}>
              {tiers().length > 0 ? 'Manage custom routing' : 'Create custom tier'}
            </button>
          </div>
        }
      >
        <div class="routing-cards header-tier-list">
          <For each={enabledTiers()}>
            {(tier) => (
              <HeaderTierCard
                agentName={props.agentName()}
                tier={tier}
                models={props.models()}
                customProviders={props.customProviders()}
                connectedProviders={props.connectedProviders()}
                onOverride={(m, p, a) => handleOverride(tier.id, m, p, a)}
                onFallbacksUpdate={() => refetch()}
              />
            )}
          </For>
        </div>
      </Show>

      {/* ── Manage custom routing modal ──────────────────── */}
      <Show when={manageOpen()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setManageOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setManageOpen(false);
          }}
        >
          <div
            class="modal-card header-tier-manage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-tiers-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="manage-tiers-title" class="specificity-modal__title">
              Manage custom routing
            </h2>
            <p class="specificity-modal__desc">
              Click a tier to edit its header rule, name, or color. Create new tiers or remove
              existing ones.
            </p>
            <div class="specificity-modal__list">
              <For each={tiers()}>
                {(tier) => {
                  const loading = () => toggling() === tier.id;
                  return (
                    <div
                      class="specificity-modal__row"
                      role="button"
                      tabIndex={0}
                      style="cursor: pointer;"
                      onClick={() => openEditFromManage(tier)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEditFromManage(tier);
                        }
                      }}
                    >
                      <div class="specificity-modal__info">
                        <span class="specificity-modal__name">{tier.name}</span>
                        <span class="specificity-modal__stage-desc">
                          {tier.header_key}: {tier.header_value}
                        </span>
                      </div>
                      <button
                        class="specificity-modal__toggle"
                        classList={{
                          'specificity-modal__toggle--on': tier.enabled,
                        }}
                        disabled={loading()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!loading()) handleToggle(tier.id, !tier.enabled);
                        }}
                        aria-label={`${tier.enabled ? 'Disable' : 'Enable'} ${tier.name}`}
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
            <div class="header-tier-manage__footer">
              <button
                type="button"
                class="btn btn--outline header-tier-manage__create-btn"
                onClick={() => {
                  setManageOpen(false);
                  setModalTier('new');
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m21,4h-1v-1c0-.55-.45-1-1-1s-1,.45-1,1v1h-1c-.55,0-1,.45-1,1s.45,1,1,1h1v1c0,.55.45,1,1,1s1-.45,1-1v-1h1c.55,0,1-.45,1-1s-.45-1-1-1Z" />
                  <path d="m3.24,16.5c0,.76.42,1.45,1.11,1.79l5.87,2.93c.56.28,1.18.42,1.79.42s1.23-.14,1.79-.42l5.87-2.93c.68-.34,1.11-1.03,1.11-1.79s-.42-1.45-1.11-1.79l-.42-.21.42-.21c.68-.34,1.11-1.03,1.11-1.79,0-.76-.42-1.45-1.11-1.79l-5.87-2.93c-1.12-.56-2.46-.56-3.58,0l-5.87,2.93c-.68.34-1.11,1.03-1.11,1.79,0,.76.42,1.45,1.11,1.79l.42.21-.42.21c-.68.34-1.11,1.03-1.11,1.79Zm2-4l5.87-2.93c.28-.14.59-.21.89-.21s.61.07.89.21l5.88,2.93-5.88,2.94c-.56.28-1.23.28-1.79,0l-4.11-2.05-1.76-.88Zm4.97,4.72c1.12.56,2.46.56,3.58,0l3.21-1.61,1.77.88-5.88,2.94c-.56.28-1.23.28-1.79,0l-5.87-2.93,1.76-.88,3.21,1.61Z" />
                </svg>
                Create new tier
              </button>
              <button class="btn btn--primary" onClick={() => setManageOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Create / Edit modal ────────────────────────── */}
      <Show when={modalTier()} keyed>
        {(state) => (
          <HeaderTierModal
            agentName={props.agentName()}
            existingTiers={tiers()}
            editing={state === 'new' ? undefined : state}
            onClose={() => {
              setModalTier(null);
              setEditFromManage(false);
            }}
            onSaved={(saved) => {
              const wasCreate = state === 'new';
              setModalTier(null);
              setEditFromManage(false);
              refetch();
              if (wasCreate) setSnippetTier(saved);
            }}
            onBack={editFromManage() ? handleBackToManage : undefined}
            onDelete={editFromManage() ? handleDeleteFromEdit : undefined}
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
    </>
  );

  if (props.embedded) {
    return (
      <div>
        <div
          class="routing-section__header routing-section__header--header-tiers"
          style="margin-bottom: 16px;"
        >
          <div>
            <span class="routing-section__subtitle">
              Route requests by HTTP header. Custom routing runs before complexity and task-specific
              routing.
            </span>
          </div>
          {manageButton()}
        </div>
        {content()}
      </div>
    );
  }

  return (
    <div class="routing-section routing-section--header-tiers">
      <div class="routing-section__header routing-section__header--header-tiers">
        <div>
          <h2 class="routing-section__title">Custom routing</h2>
          <p class="routing-section__subtitle">
            Route requests by HTTP header. Custom routing runs before complexity and task-specific
            routing.
          </p>
        </div>
        {manageButton()}
      </div>
      {content()}
    </div>
  );
};

export default RoutingHeaderTiersSection;
