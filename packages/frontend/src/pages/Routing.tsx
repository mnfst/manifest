import { createSignal, createResource, createMemo, Show, type Component } from 'solid-js';
import { useLocation, useParams, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import RoutingModals from '../components/RoutingModals.js';
import { buildPipelineHelp } from '../components/RoutingPipelineCard.js';
import RoutingTabs from '../components/RoutingTabs.js';
import { toast } from '../services/toast-store.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import RoutingDefaultTierSection from './RoutingDefaultTierSection.js';
import RoutingComplexitySection from './RoutingComplexitySection.js';
import RoutingSpecificitySection from './RoutingSpecificitySection.js';
import RoutingHeaderTiersSection from './RoutingHeaderTiersSection.js';
import {
  RoutingLoadingSkeleton,
  EnableRoutingCard,
  ActiveProviderIcons,
  RoutingFooter,
} from './RoutingPanels.js';
import { createRoutingActions } from './RoutingActions.js';
import { listHeaderTiers, type HeaderTier } from '../services/api/header-tiers.js';
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  getCustomProviders,
  getSpecificityAssignments,
  getComplexityStatus,
  overrideSpecificity,
  resetSpecificity,
  refreshModels,
  getPricingHealth,
  refreshPricing,
} from '../services/api.js';
import {
  parseCustomProviderParams,
  parseProviderDeepLink,
  type CustomProviderPrefill,
  type ProviderDeepLink,
} from '../services/routing-params.js';

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ openProviders?: boolean }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentName = () => decodeURIComponent(params.agentName);

  const customProviderPrefill = createMemo(() => parseCustomProviderParams(searchParams));
  const providerDeepLink = createMemo(() => parseProviderDeepLink(searchParams));

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
  const [specificityAssignments, { refetch: refetchSpecificity }] = createResource(
    () => agentName(),
    getSpecificityAssignments,
  );
  const [complexityStatus, { mutate: mutateComplexity }] = createResource(
    () => agentName(),
    getComplexityStatus,
  );
  const complexityEnabled = () => complexityStatus()?.enabled ?? false;
  const [headerTiers, { refetch: refetchHeaderTiers }] = createResource(
    () => agentName(),
    (name) => listHeaderTiers(name).catch(() => [] as HeaderTier[]),
  );
  const hasCustomTiersEnabled = () => headerTiers()?.some((t) => t.enabled) ?? false;
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [specificityDropdown, setSpecificityDropdown] = createSignal<string | null>(null);
  const [changingSpecificity, setChangingSpecificity] = createSignal<string | null>(null);
  const [resettingSpecificity, setResettingSpecificity] = createSignal<string | null>(null);
  const [showProviderModal, setShowProviderModal] = createSignal(
    !!(location.state as { openProviders?: boolean } | undefined)?.openProviders ||
      !!customProviderPrefill() ||
      !!providerDeepLink(),
  );
  const [confirmDisable, setConfirmDisable] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
  const [instructionProvider, setInstructionProvider] = createSignal<string | null>(null);
  const [fallbackPickerTier, setFallbackPickerTier] = createSignal<string | null>(null);
  const [refreshingModels, setRefreshingModels] = createSignal(false);
  const [pricingHealth, { refetch: refetchPricingHealth }] = createResource(getPricingHealth);
  const [refreshingPricing, setRefreshingPricing] = createSignal(false);
  const pricingCacheEmpty = () => (pricingHealth()?.model_count ?? 0) === 0;
  const [wasEnabledBeforeModal, setWasEnabledBeforeModal] = createSignal(false);
  const [hadProvidersBeforeModal, setHadProvidersBeforeModal] = createSignal(false);

  const refetchAll = async () => {
    await Promise.all([
      refetchProviders(),
      refetchCustomProviders(),
      refetchTiers(),
      refetchModels(),
      refetchSpecificity(),
      refetchHeaderTiers(),
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

  const hasAnySpecificityActive = () => specificityAssignments()?.some((a) => a.is_active) ?? false;

  const isSpecificityTier = (tierId: string) =>
    specificityAssignments()?.some((a) => a.category === tierId) ?? false;

  const handleAddFallback: typeof actions.handleAddFallback = async (
    tierId,
    modelName,
    providerId,
    authType,
  ) => {
    setFallbackPickerTier(null);
    if (isSpecificityTier(tierId)) {
      const sa = specificityAssignments()?.find((a) => a.category === tierId);
      const current = sa?.fallback_models ?? [];
      if (current.includes(modelName)) return;
      const updated = [...current, modelName];
      try {
        const { setSpecificityFallbacks } = await import('../services/api.js');
        await setSpecificityFallbacks(agentName(), tierId, updated);
        await refetchSpecificity();
        toast.success('Fallback added');
      } catch {
        toast.error('Failed to add fallback');
      }
      return;
    }
    return actions.handleAddFallback(tierId, modelName, providerId, authType);
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
    if (customProviderPrefill() || providerDeepLink()) {
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
            {agentDisplayName() ?? agentName()} &rsaquo; Pick which model handles each type of
            request
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

      <Show when={pricingHealth() && pricingCacheEmpty()}>
        <div
          class="panel"
          role="alert"
          style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; border-left: 3px solid var(--color-warning, #d97706);"
        >
          <div>
            <strong>Pricing catalog is empty.</strong>{' '}
            <span>
              Manifest couldn't reach openrouter.ai at startup, so no models will be auto-assigned
              to tiers. Retry below, or check outbound network access to openrouter.ai.
            </span>
          </div>
          <button
            class="btn btn--outline btn--sm"
            disabled={refreshingPricing()}
            onClick={async () => {
              setRefreshingPricing(true);
              try {
                const res = await refreshPricing();
                await refetchPricingHealth();
                if (res.ok) {
                  toast.success(`Pricing catalog loaded (${res.model_count} models)`);
                  await refetchModels();
                  await refetchTiers();
                } else {
                  toast.error('Pricing refresh failed — check backend logs');
                }
              } catch {
                toast.error('Pricing refresh failed');
              } finally {
                setRefreshingPricing(false);
              }
            }}
          >
            {refreshingPricing() ? 'Retrying...' : 'Retry pricing sync'}
          </button>
        </div>
      </Show>

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

          <RoutingTabs
            complexityEnabled={complexityEnabled}
            specificityEnabled={hasAnySpecificityActive}
            customEnabled={hasCustomTiersEnabled}
            pipelineHelp={() =>
              buildPipelineHelp(
                complexityEnabled(),
                hasAnySpecificityActive(),
                hasCustomTiersEnabled(),
              )
            }
          >
            {{
              default: (
                <RoutingDefaultTierSection
                  agentName={agentName}
                  tier={() => actions.getTier('default')}
                  complexityEnabled={complexityEnabled}
                  models={() => models() ?? []}
                  customProviders={() => customProviders() ?? []}
                  activeProviders={activeProviders}
                  connectedProviders={() => connectedProviders() ?? []}
                  tiersLoading={tiers.loading}
                  changingTier={actions.changingTier}
                  resettingTier={actions.resettingTier}
                  resettingAll={actions.resettingAll}
                  addingFallback={actions.addingFallback}
                  onDropdownOpen={(tierId) => setDropdownTier(tierId)}
                  onOverride={handleOverride}
                  onReset={actions.handleReset}
                  onFallbackUpdate={actions.handleFallbackUpdate}
                  onAddFallback={(tierId) => setFallbackPickerTier(tierId)}
                  getFallbacksFor={actions.getFallbacksFor}
                  embedded
                />
              ),
              complexity: (
                <RoutingComplexitySection
                  agentName={agentName}
                  enabled={complexityEnabled}
                  onEnabledChange={(next) => mutateComplexity({ enabled: next })}
                  tiers={() => tiers() ?? []}
                  models={() => models() ?? []}
                  customProviders={() => customProviders() ?? []}
                  activeProviders={activeProviders}
                  connectedProviders={() => connectedProviders() ?? []}
                  tiersLoading={tiers.loading}
                  changingTier={actions.changingTier}
                  resettingTier={actions.resettingTier}
                  resettingAll={actions.resettingAll}
                  addingFallback={actions.addingFallback}
                  onDropdownOpen={(tierId) => setDropdownTier(tierId)}
                  onOverride={handleOverride}
                  onReset={actions.handleReset}
                  onFallbackUpdate={actions.handleFallbackUpdate}
                  onAddFallback={(tierId) => setFallbackPickerTier(tierId)}
                  getFallbacksFor={actions.getFallbacksFor}
                  getTier={actions.getTier}
                  embedded
                />
              ),
              specificity: (
                <RoutingSpecificitySection
                  agentName={agentName}
                  assignments={specificityAssignments}
                  models={() => models() ?? []}
                  customProviders={() => customProviders() ?? []}
                  activeProviders={activeProviders}
                  connectedProviders={() => connectedProviders() ?? []}
                  changingTier={changingSpecificity}
                  resettingTier={resettingSpecificity}
                  resettingAll={() => false}
                  addingFallback={() => null}
                  onDropdownOpen={(category) => setSpecificityDropdown(category)}
                  onOverride={async (category, model, provider, authType) => {
                    setChangingSpecificity(category);
                    try {
                      await overrideSpecificity(agentName(), category, model, provider, authType);
                      await refetchSpecificity();
                    } catch {
                      toast.error('Failed to update model');
                    } finally {
                      setChangingSpecificity(null);
                    }
                  }}
                  onReset={async (category) => {
                    setResettingSpecificity(category);
                    try {
                      await resetSpecificity(agentName(), category);
                      await refetchSpecificity();
                    } catch {
                      toast.error('Failed to reset');
                    } finally {
                      setResettingSpecificity(null);
                    }
                  }}
                  onFallbackUpdate={async (category, updatedFallbacks) => {
                    try {
                      if (updatedFallbacks.length === 0) {
                        const { clearSpecificityFallbacks } = await import('../services/api.js');
                        await clearSpecificityFallbacks(agentName(), category);
                      } else {
                        const { setSpecificityFallbacks } = await import('../services/api.js');
                        await setSpecificityFallbacks(agentName(), category, updatedFallbacks);
                      }
                      await refetchSpecificity();
                    } catch {
                      toast.error('Failed to update fallbacks');
                    }
                  }}
                  onAddFallback={(category) => setFallbackPickerTier(category)}
                  refetchAll={refetchAll}
                  refetchSpecificity={async () => {
                    await refetchSpecificity();
                  }}
                  embedded
                />
              ),
              custom: (
                <RoutingHeaderTiersSection
                  agentName={agentName}
                  models={() => models() ?? []}
                  customProviders={() => customProviders() ?? []}
                  connectedProviders={() => connectedProviders() ?? []}
                  externalTiers={() => headerTiers()}
                  externalRefetch={() => void refetchHeaderTiers()}
                  embedded
                />
              ),
            }}
          </RoutingTabs>

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
        specificityDropdown={specificityDropdown}
        onSpecificityDropdownClose={() => setSpecificityDropdown(null)}
        onSpecificityOverride={async (category, model, provider, authType) => {
          setSpecificityDropdown(null);
          setChangingSpecificity(category);
          try {
            await overrideSpecificity(agentName(), category, model, provider, authType);
            await refetchSpecificity();
          } catch {
            toast.error('Failed to update specificity model');
          } finally {
            setChangingSpecificity(null);
          }
        }}
        fallbackPickerTier={fallbackPickerTier}
        onFallbackPickerClose={() => setFallbackPickerTier(null)}
        showProviderModal={showProviderModal}
        onProviderModalClose={closeProviderModal}
        customProviderPrefill={customProviderPrefill()}
        providerDeepLink={providerDeepLink()}
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
        specificityAssignments={() => specificityAssignments() ?? []}
        customProviders={() => customProviders() ?? []}
        connectedProviders={() => connectedProviders() ?? []}
        getTier={(tierId) => {
          const generalist = actions.getTier(tierId);
          if (generalist) return generalist;
          const sa = specificityAssignments()?.find((a) => a.category === tierId);
          if (sa) return { ...sa, tier: sa.category };
          return undefined;
        }}
        onOverride={handleOverride}
        onAddFallback={handleAddFallback}
        onProviderUpdate={handleProviderUpdate}
      />
    </div>
  );
};

export default Routing;
