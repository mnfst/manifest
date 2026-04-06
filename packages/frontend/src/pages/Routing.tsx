import { createSignal, createResource, createMemo, For, Show, type Component } from 'solid-js';
import { useLocation, useParams, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { STAGES } from '../services/providers.js';
import RoutingModals from '../components/RoutingModals.js';
import { toast } from '../services/toast-store.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import RoutingTierCard from './RoutingTierCard.js';
import {
  RoutingLoadingSkeleton,
  EnableRoutingCard,
  ActiveProviderIcons,
  RoutingFooter,
} from './RoutingPanels.js';
import { createRoutingActions } from './RoutingActions.js';
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  getCustomProviders,
  refreshModels,
} from '../services/api.js';
import {
  parseCustomProviderParams,
  type CustomProviderPrefill,
} from '../services/routing-params.js';

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ openProviders?: boolean }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentName = () => decodeURIComponent(params.agentName);

  const customProviderPrefill = createMemo(() => parseCustomProviderParams(searchParams));

  const [tiers, { refetch: refetchTiers, mutate: mutateTiers }] = createResource(
    () => agentName(),
    getTierAssignments,
  );
  const [models, { refetch: refetchModels }] = createResource(
    () => agentName(),
    getAvailableModels,
  );
  const [connectedProviders, { refetch: refetchProviders, mutate: mutateProviders }] =
    createResource(() => agentName(), getProviders);
  const [customProviders, { refetch: refetchCustomProviders }] = createResource(
    () => agentName(),
    getCustomProviders,
  );
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [showProviderModal, setShowProviderModal] = createSignal(
    !!(location.state as { openProviders?: boolean } | undefined)?.openProviders ||
      !!customProviderPrefill(),
  );
  const [confirmDisable, setConfirmDisable] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
  const [instructionProvider, setInstructionProvider] = createSignal<string | null>(null);
  const [fallbackPickerTier, setFallbackPickerTier] = createSignal<string | null>(null);
  const [refreshingModels, setRefreshingModels] = createSignal(false);
  const [wasEnabledBeforeModal, setWasEnabledBeforeModal] = createSignal(false);
  const [hadProvidersBeforeModal, setHadProvidersBeforeModal] = createSignal(false);

  const refetchAll = async () => {
    await Promise.all([
      refetchProviders(),
      refetchCustomProviders(),
      refetchTiers(),
      refetchModels(),
    ]);
  };

  const actions = createRoutingActions({
    agentName,
    tiers,
    mutateTiers,
    connectedProviders,
    mutateProviders,
    refetchAll,
    setInstructionModal,
  });

  const handleOverride: typeof actions.handleOverride = async (...args) => {
    setDropdownTier(null);
    return actions.handleOverride(...args);
  };

  const handleAddFallback: typeof actions.handleAddFallback = async (...args) => {
    setFallbackPickerTier(null);
    return actions.handleAddFallback(...args);
  };

  const isEnabled = () => connectedProviders()?.some((p) => p.is_active) ?? false;
  const hadRouting = () => (connectedProviders()?.length ?? 0) > 0 && !isEnabled();
  const activeProviders = () => connectedProviders()?.filter((p) => p.is_active) ?? [];
  const hasOverrides = () => tiers()?.some((t) => t.override_model !== null) ?? false;

  const openProviderModal = () => {
    setWasEnabledBeforeModal(isEnabled());
    setHadProvidersBeforeModal((connectedProviders()?.length ?? 0) > 0);
    setShowProviderModal(true);
  };

  const closeProviderModal = () => {
    setShowProviderModal(false);
    if (customProviderPrefill()) {
      setSearchParams({
        provider: undefined,
        name: undefined,
        baseUrl: undefined,
        apiKey: undefined,
        models: undefined,
      });
    }
    if (!wasEnabledBeforeModal() && isEnabled() && hadProvidersBeforeModal()) {
      setInstructionModal('enable');
    }
  };

  const handleProviderUpdate = async () => {
    await refetchAll();
  };

  return (
    <div class="container--lg">
      <Title>{agentDisplayName() ?? agentName()} Routing - Manifest</Title>
      <Meta
        name="description"
        content={`Configure model routing for ${agentDisplayName() ?? agentName()}.`}
      />

      <div class="page-header routing-page-header">
        <div>
          <h1>Routing</h1>
          <span class="breadcrumb">
            {agentDisplayName() ?? agentName()} &rsaquo; Route requests to different models based on
            complexity
          </span>
        </div>
        <Show when={!connectedProviders.loading && isEnabled()}>
          <div style="display: flex; gap: 8px;">
            <button
              class="btn btn--outline btn--sm"
              disabled={refreshingModels()}
              onClick={async () => {
                setRefreshingModels(true);
                try {
                  await refreshModels(agentName());
                  refetchModels();
                  refetchTiers();
                  toast.success('Models refreshed');
                } catch {
                  toast.error('Failed to refresh models');
                } finally {
                  setRefreshingModels(false);
                }
              }}
            >
              {refreshingModels() ? 'Refreshing...' : 'Refresh models'}
            </button>
            <button class="btn btn--primary btn--sm" onClick={openProviderModal}>
              Connect providers
            </button>
          </div>
        </Show>
      </div>

      <Show
        when={!connectedProviders.loading}
        fallback={
          <Show
            when={
              connectedProviders() !== undefined && connectedProviders()?.some((p) => p.is_active)
            }
            fallback={
              <div
                class="panel"
                style="display: flex; align-items: center; justify-content: center; min-height: 260px;"
              >
                <span
                  class="spinner"
                  style="width: 24px; height: 24px;"
                  role="status"
                  aria-label="Loading"
                />
              </div>
            }
          >
            <RoutingLoadingSkeleton />
          </Show>
        }
      >
        <Show when={isEnabled()} fallback={<EnableRoutingCard onEnable={openProviderModal} />}>
          <ActiveProviderIcons
            activeProviders={activeProviders}
            customProviders={() => customProviders() ?? []}
          />

          <div class="routing-cards">
            <For each={STAGES}>
              {(stage) => (
                <RoutingTierCard
                  stage={stage}
                  tier={() => actions.getTier(stage.id)}
                  models={() => models() ?? []}
                  customProviders={() => customProviders() ?? []}
                  activeProviders={activeProviders}
                  tiersLoading={tiers.loading}
                  changingTier={actions.changingTier}
                  resettingTier={actions.resettingTier}
                  resettingAll={actions.resettingAll}
                  addingFallback={actions.addingFallback}
                  agentName={agentName}
                  onDropdownOpen={(tierId) => setDropdownTier(tierId)}
                  onOverride={handleOverride}
                  onReset={actions.handleReset}
                  onFallbackUpdate={actions.handleFallbackUpdate}
                  onAddFallback={(tierId) => setFallbackPickerTier(tierId)}
                  getFallbacksFor={actions.getFallbacksFor}
                  connectedProviders={() => connectedProviders() ?? []}
                />
              )}
            </For>
          </div>

          <RoutingFooter
            disabling={actions.disabling}
            hasOverrides={hasOverrides}
            resettingAll={actions.resettingAll}
            resettingTier={actions.resettingTier}
            onDisable={() => setConfirmDisable(true)}
            onResetAll={actions.handleResetAll}
            onShowInstructions={() => setInstructionModal('enable')}
          />
        </Show>
      </Show>

      <Show when={hadRouting()}>
        <div class="routing-footer" style="margin-top: 0;">
          <div style="flex: 1;" />
          <button
            class="routing-footer__instructions"
            onClick={() => setInstructionModal('disable')}
          >
            Setup instructions
          </button>
        </div>
      </Show>

      <RoutingModals
        agentName={agentName}
        dropdownTier={dropdownTier}
        onDropdownClose={() => setDropdownTier(null)}
        fallbackPickerTier={fallbackPickerTier}
        onFallbackPickerClose={() => setFallbackPickerTier(null)}
        showProviderModal={showProviderModal}
        onProviderModalClose={closeProviderModal}
        customProviderPrefill={customProviderPrefill()}
        instructionModal={instructionModal}
        instructionProvider={instructionProvider}
        onInstructionClose={() => {
          setInstructionModal(null);
          setInstructionProvider(null);
        }}
        confirmDisable={confirmDisable}
        disabling={actions.disabling}
        onDisableCancel={() => setConfirmDisable(false)}
        onDisableConfirm={async () => {
          setConfirmDisable(false);
          await actions.handleDisable();
        }}
        models={() => models() ?? []}
        tiers={() => tiers() ?? []}
        customProviders={() => customProviders() ?? []}
        connectedProviders={() => connectedProviders() ?? []}
        getTier={actions.getTier}
        onOverride={handleOverride}
        onAddFallback={handleAddFallback}
        onProviderUpdate={handleProviderUpdate}
      />
    </div>
  );
};

export default Routing;
