import { createSignal, createResource, createMemo, Show, type Component } from 'solid-js';
import { useLocation, useParams, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import RoutingModals from '../components/RoutingModals.js';
import { buildPipelineHelp } from '../components/RoutingPipelineCard.js';
import RoutingTabs from '../components/RoutingTabs.js';
import { toast } from '../services/toast-store.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import RoutingDefaultTierSection from './RoutingDefaultTierSection.js';
import RoutingSpecificitySection from './RoutingSpecificitySection.js';
import RoutingHeaderTiersSection from './RoutingHeaderTiersSection.js';
import { RoutingLoadingSkeleton, ActiveProviderIcons, RoutingFooter } from './RoutingPanels.js';
import { createRoutingActions } from './RoutingActions.js';
import { listHeaderTiers, type HeaderTier } from '../services/api/header-tiers.js';
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  getCustomProviders,
  getSpecificityAssignments,
  overrideSpecificity,
  resetSpecificity,
  refreshModels,
  getPricingHealth,
  refreshPricing,
  getComplexityStatus,
  toggleComplexity,
} from '../services/api.js';
import { parseCustomProviderParams, parseProviderDeepLink } from '../services/routing-params.js';

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
  const [connectedProviders, { refetch: refetchProviders }] = createResource(
    () => agentName(),
    getProviders,
  );
  const [customProviders, { refetch: refetchCustomProviders }] = createResource(
    () => agentName(),
    getCustomProviders,
  );
  const [specificityAssignments, { refetch: refetchSpecificity }] = createResource(
    () => agentName(),
    getSpecificityAssignments,
  );
  const [headerTiers, { refetch: refetchHeaderTiers }] = createResource(
    () => agentName(),
    (name) => listHeaderTiers(name).catch(() => [] as HeaderTier[]),
  );
  const [complexityStatus, { refetch: refetchComplexityStatus, mutate: mutateComplexityStatus }] =
    createResource(() => agentName(), getComplexityStatus);
  const [togglingComplexity, setTogglingComplexity] = createSignal(false);
  const complexityEnabled = () => complexityStatus()?.enabled ?? true;

  const handleToggleComplexity = async () => {
    setTogglingComplexity(true);
    try {
      const result = await toggleComplexity(agentName());
      mutateComplexityStatus(result);
    } catch {
      toast.error('Failed to toggle complexity routing');
    } finally {
      setTogglingComplexity(false);
    }
  };

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
  const activeProviders = () => connectedProviders()?.filter((p) => p.is_active) ?? [];
  const hasProviders = () => activeProviders().length > 0 || (customProviders()?.length ?? 0) > 0;
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

  const handleSpecificityOverride = async (
    category: string,
    model: string,
    provider: string,
    authType?: 'api_key' | 'subscription' | 'local',
  ) => {
    setChangingSpecificity(category);
    try {
      await overrideSpecificity(agentName(), category, model, provider, authType);
      await refetchSpecificity();
    } catch {
      toast.error('Failed to update specificity model');
    } finally {
      setChangingSpecificity(null);
    }
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
        <Show when={!connectedProviders.loading}>
          <div style="display: flex; gap: 8px;">
            <Show when={isEnabled()}>
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
            </Show>
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

      <Show when={!connectedProviders.loading} fallback={<RoutingLoadingSkeleton />}>
        <Show
          when={hasProviders()}
          fallback={
            <div class="routing-no-providers">
              <svg
                class="routing-no-providers__icon"
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20 10c-.74 0-1.38.4-1.72 1H13V9h4c.55 0 1-.45 1-1V5.72c.6-.35 1-.98 1-1.72 0-1.1-.9-2-2-2s-2 .9-2 2c0 .74.4 1.38 1 1.72V7h-3V5c0-1.65-1.35-3-3-3-1.3 0-2.41.83-2.83 2.01A3.51 3.51 0 0 0 4 7.5c0 .33.05.65.14.96C2.87 9.14 2 10.49 2 12c0 1.08.43 2.09 1.17 2.83-.11.38-.17.77-.17 1.17 0 1.96 1.41 3.59 3.31 3.93C6.86 21.16 8.11 22 9.5 22c1.93 0 3.5-1.57 3.5-3.5V17h3v1.28c-.6.35-1 .98-1 1.72 0 1.1.9 2 2 2s2-.9 2-2c0-.74-.4-1.38-1-1.72V16c0-.55-.45-1-1-1h-4v-2h5.28c.35.6.98 1 1.72 1 1.1 0 2-.9 2-2s-.9-2-2-2m-9 8.5c0 .83-.67 1.5-1.5 1.5-.71 0-1.33-.5-1.47-1.2l-.21-.8H7c-1.1 0-2-.9-2-2 0-.35.08-.68.25-.98l.46-.82-.78-.51C4.35 13.31 4 12.68 4 12c0-.98.72-1.82 1.68-1.97l1.69-.26-1.06-1.35c-.2-.26-.32-.59-.32-.92 0-.83.67-1.5 1.5-1.5.11 0 .21.01.31.03l1.19.17V4.99c0-.55.45-1 1-1s1 .45 1 1v13.5Z" />
              </svg>
              <span class="routing-no-providers__title">No providers connected</span>
              <span class="routing-no-providers__desc">
                Connect a model provider to start configuring your routing rules.
              </span>
              <button class="btn btn--primary btn--sm" onClick={openProviderModal}>
                Connect provider
              </button>
            </div>
          }
        >
          <Show when={isEnabled()}>
            <ActiveProviderIcons
              activeProviders={activeProviders}
              customProviders={() => customProviders() ?? []}
            />
          </Show>

          <RoutingTabs
            specificityEnabled={hasAnySpecificityActive}
            customEnabled={hasCustomTiersEnabled}
            pipelineHelp={() =>
              buildPipelineHelp(
                hasAnySpecificityActive(),
                hasCustomTiersEnabled(),
                complexityEnabled(),
              )
            }
          >
            {{
              default: (
                <RoutingDefaultTierSection
                  agentName={agentName}
                  tier={() => actions.getTier('default')}
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
                  complexityEnabled={complexityEnabled}
                  togglingComplexity={togglingComplexity}
                  onToggleComplexity={handleToggleComplexity}
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
                  onOverride={handleSpecificityOverride}
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
                  refetchSpecificity={() => refetchSpecificity() as unknown as Promise<void>}
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
            hasOverrides={hasOverrides}
            resettingAll={actions.resettingAll}
            resettingTier={actions.resettingTier}
            onResetAll={actions.handleResetAll}
            onShowInstructions={() => setInstructionModal('enable')}
          />
        </Show>
      </Show>

      <RoutingModals
        agentName={agentName}
        dropdownTier={dropdownTier}
        onDropdownClose={() => setDropdownTier(null)}
        specificityDropdown={specificityDropdown}
        onSpecificityDropdownClose={() => setSpecificityDropdown(null)}
        onSpecificityOverride={(category, model, provider, authType) => {
          setSpecificityDropdown(null);
          void handleSpecificityOverride(category, model, provider, authType);
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
        models={() => models() ?? []}
        tiers={() => tiers() ?? []}
        specificityAssignments={() => specificityAssignments() ?? []}
        customProviders={() => customProviders() ?? []}
        connectedProviders={() => connectedProviders() ?? []}
        getTier={(tierId) => {
          const generalist = actions.getTier(tierId);
          if (generalist) return generalist;
          const sa = specificityAssignments()?.find((a) => a.category === tierId);
          return sa ? { ...sa, tier: sa.category } : undefined;
        }}
        onOverride={handleOverride}
        onAddFallback={handleAddFallback}
        onProviderUpdate={handleProviderUpdate}
        onOpenProviderModal={openProviderModal}
      />
    </div>
  );
};

export default Routing;
