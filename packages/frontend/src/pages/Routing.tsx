import {
  createSignal,
  createResource,
  createMemo,
  createEffect,
  Show,
  type Component,
} from 'solid-js';
import { useLocation, useParams, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import RoutingModals from '../components/RoutingModals.js';
import { buildPipelineHelp } from '../components/RoutingPipelineCard.js';
import RoutingTabs from '../components/RoutingTabs.js';
import ResponseModeModal from '../components/ResponseModeModal.js';
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
  setTierResponseMode,
  getAvailableModels,
  getProviders,
  getCustomProviders,
  getSpecificityAssignments,
  setSpecificityResponseMode,
  overrideSpecificity,
  resetSpecificity,
  refreshModels,
  getPricingHealth,
  getComplexityStatus,
  toggleComplexity,
  listModelParams,
  setModelParams as setModelParamsApi,
  deleteModelParams,
  modelParamsKey,
  type AgentModelParamsRow,
  type AuthType,
  type RequestParamDefaults,
  type ResponseMode,
} from '../services/api.js';
import { parseCustomProviderParams, parseProviderDeepLink } from '../services/routing-params.js';
import { STAGES } from '../services/providers.js';
// Route-scoped: keep the large routing stylesheet (and its sub-imports) out
// of the global theme bundle so login/overview/etc. don't download it.
import '../styles/routing.css';

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
  const [specificityAssignments, { refetch: refetchSpecificity, mutate: mutateSpecificity }] =
    createResource(() => agentName(), getSpecificityAssignments);
  const [headerTiers, { refetch: refetchHeaderTiers, mutate: mutateHeaderTiers }] = createResource(
    () => agentName(),
    (name) => listHeaderTiers(name).catch(() => [] as HeaderTier[]),
  );
  const [complexityStatus, { mutate: mutateComplexityStatus }] = createResource(
    () => agentName(),
    getComplexityStatus,
  );
  const [togglingComplexity, setTogglingComplexity] = createSignal(false);
  const [changingDefaultResponseMode, setChangingDefaultResponseMode] = createSignal(false);
  const [changingSpecificityResponseMode, setChangingSpecificityResponseMode] = createSignal(false);
  const complexityEnabled = () => complexityStatus()?.enabled ?? true;

  // Per-route model params, fetched once and threaded down. Scope separates
  // default/complexity tiers, task-specific tiers, and custom header tiers so
  // the same model can have different values in different routing surfaces.
  const [modelParams, { mutate: mutateModelParams }] = createResource(
    () => agentName(),
    (name) => listModelParams(name).catch(() => [] as AgentModelParamsRow[]),
  );
  const modelParamsMap = createMemo(() => {
    const map = new Map<string, RequestParamDefaults>();
    for (const row of modelParams() ?? []) {
      map.set(modelParamsKey(row.scope, row.provider, row.authType, row.model), row.params);
    }
    return map;
  });
  const getModelParamsFor = (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
  ): RequestParamDefaults | null =>
    modelParamsMap().get(modelParamsKey(scope, provider, authType, model)) ?? null;

  const setModelParamsFor = async (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
    next: RequestParamDefaults | null,
  ): Promise<void> => {
    if (next === null) {
      // Dialog returns null when the user collapses back to the provider's
      // natural default. Delete the row so the table stays clean and the
      // dashboard snapshot reflects the provider default, not an explicit
      // override.
      await deleteModelParams(agentName(), { scope, provider, authType, model });
      mutateModelParams((rows) =>
        (rows ?? []).filter(
          (r) =>
            !(
              r.scope === scope &&
              r.provider.toLowerCase() === provider.toLowerCase() &&
              r.authType === authType &&
              r.model === model
            ),
        ),
      );
      return;
    }
    const saved = await setModelParamsApi(agentName(), {
      scope,
      provider,
      authType,
      model,
      params: next,
    });
    mutateModelParams((rows) => {
      const without = (rows ?? []).filter(
        (r) =>
          !(
            r.scope === scope &&
            r.provider.toLowerCase() === provider.toLowerCase() &&
            r.authType === authType &&
            r.model === model
          ),
      );
      return [...without, saved];
    });
  };

  const handleToggleComplexity = async () => {
    const shouldInheritStreaming = defaultResponseMode() === 'stream';
    setTogglingComplexity(true);
    try {
      const result = await toggleComplexity(agentName());
      mutateComplexityStatus(result);
      if (shouldInheritStreaming) {
        await handleDefaultResponseModeChange('stream');
      }
    } catch {
      toast.error('Failed to toggle complexity routing');
    } finally {
      setTogglingComplexity(false);
    }
  };

  const defaultResponseMode = (): ResponseMode => {
    const ids = complexityEnabled() ? STAGES.map((stage) => stage.id) : ['default'];
    return ids.every((id) => actions.getTier(id)?.response_mode === 'stream')
      ? 'stream'
      : 'buffered';
  };

  const handleDefaultResponseModeChange = async (responseMode: ResponseMode) => {
    const ids = complexityEnabled() ? STAGES.map((stage) => stage.id) : ['default'];
    setChangingDefaultResponseMode(true);
    try {
      const updated = await Promise.all(
        ids.map((tier) => setTierResponseMode(agentName(), tier, responseMode)),
      );
      mutateTiers((prev) => {
        const byTier = new Map(updated.map((row) => [row.tier, row]));
        const merged = (prev ?? []).map((row) => byTier.get(row.tier) ?? row);
        for (const row of updated) {
          if (!merged.some((existing) => existing.tier === row.tier)) merged.push(row);
        }
        return merged;
      });
      toast.success(
        responseMode === 'stream'
          ? 'Streaming response mode enabled'
          : 'Buffered response mode enabled',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update response mode');
    } finally {
      setChangingDefaultResponseMode(false);
    }
  };

  const activeSpecificityAssignments = () =>
    specificityAssignments()?.filter((assignment) => assignment.is_active) ?? [];

  const specificityResponseMode = (): ResponseMode => {
    const active = activeSpecificityAssignments();
    return active.length > 0 && active.every((assignment) => assignment.response_mode === 'stream')
      ? 'stream'
      : 'buffered';
  };

  const handleSpecificityResponseModeChange = async (responseMode: ResponseMode) => {
    const active = activeSpecificityAssignments();
    if (active.length === 0) return;
    setChangingSpecificityResponseMode(true);
    try {
      const updated = await Promise.all(
        active.map((assignment) =>
          setSpecificityResponseMode(agentName(), assignment.category, responseMode),
        ),
      );
      mutateSpecificity((prev) => {
        const byCategory = new Map(updated.map((row) => [row.category, row]));
        return prev?.map((row) => byCategory.get(row.category) ?? row);
      });
      toast.success(
        responseMode === 'stream'
          ? 'Streaming response mode enabled'
          : 'Buffered response mode enabled',
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update task-specific response mode',
      );
    } finally {
      setChangingSpecificityResponseMode(false);
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
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [responseModeModalOpen, setResponseModeModalOpen] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
  const [instructionProvider, setInstructionProvider] = createSignal<string | null>(null);
  const [fallbackPickerTier, setFallbackPickerTier] = createSignal<string | null>(null);
  const [refreshingModels, setRefreshingModels] = createSignal(false);
  const [pricingHealth] = createResource(getPricingHealth);
  const [pricingWarningShown, setPricingWarningShown] = createSignal(false);
  const [wasEnabledBeforeModal, setWasEnabledBeforeModal] = createSignal(false);
  const [hadProvidersBeforeModal, setHadProvidersBeforeModal] = createSignal(false);

  createEffect(() => {
    const health = pricingHealth();
    if (!health) return;
    if (health.model_count > 0) {
      setPricingWarningShown(false);
      return;
    }
    if (pricingWarningShown()) return;
    setPricingWarningShown(true);
    toast.warning('Model pricing data is unavailable. Automatic tier defaults may be delayed.');
  });

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
    providerKeyLabel,
  ) => {
    setFallbackPickerTier(null);
    if (isSpecificityTier(tierId)) {
      const sa = specificityAssignments()?.find((a) => a.category === tierId);
      const currentRoutes = sa?.fallback_routes ?? [];
      const current = currentRoutes.map((r) => r.model);
      if (current.includes(modelName)) return;
      const updated = [...current, modelName];
      // Pass explicit (provider, authType, model) routes so the backend can
      // disambiguate when the same model id is offered by multiple connected
      // providers (e.g. OpenAI subscription + OpenAI API key both expose
      // gpt-4o). Without this the backend silently stores nothing.
      const updatedRoutes =
        authType !== undefined
          ? [...currentRoutes, { provider: providerId, authType, model: modelName }]
          : undefined;
      try {
        const { setSpecificityFallbacks } = await import('../services/api.js');
        await setSpecificityFallbacks(agentName(), tierId, updated, updatedRoutes);
        await refetchSpecificity();
        toast.success('Fallback added');
      } catch {
        toast.error('Failed to add fallback');
      }
      return;
    }
    return actions.handleAddFallback(tierId, modelName, providerId, authType, providerKeyLabel);
  };

  const isEnabled = () => connectedProviders()?.some((p) => p.is_active) ?? false;
  const activeProviders = () => connectedProviders()?.filter((p) => p.is_active) ?? [];
  const hasProviders = () => activeProviders().length > 0 || (customProviders()?.length ?? 0) > 0;
  const hasOverrides = () => tiers()?.some((t) => t.override_route !== null) ?? false;

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

  const handleProviderPoll = async () => {
    await refetchProviders();
  };

  const handleSpecificityOverride = async (
    category: string,
    model: string,
    provider: string,
    authType?: 'api_key' | 'subscription' | 'local',
    providerKeyLabel?: string,
  ) => {
    setChangingSpecificity(category);
    try {
      await overrideSpecificity(agentName(), category, model, provider, authType, providerKeyLabel);
      await refetchSpecificity();
    } catch {
      toast.error('Failed to update specificity model');
    } finally {
      setChangingSpecificity(null);
    }
  };

  /**
   * Pin a task-specific (specificity) tier to a labeled provider key.
   * Re-uses the same PUT endpoint as `handleSpecificityOverride` — the
   * model/provider/auth_type stay the same, only the key label changes.
   */
  const handleSpecificityPinKey = async (
    category: string,
    provider: string,
    providerKeyLabel: string | null,
    authType?: 'api_key' | 'subscription' | 'local',
  ) => {
    const assignment = specificityAssignments()?.find((a) => a.category === category);
    const effective = assignment?.override_route ?? assignment?.auto_assigned_route ?? null;
    const model = effective?.model;
    if (!assignment || !model || !provider) return;
    setChangingSpecificity(category);
    try {
      await overrideSpecificity(
        agentName(),
        category,
        model,
        provider,
        authType ?? effective?.authType,
        providerKeyLabel ?? undefined,
      );
      await refetchSpecificity();
      toast.success(providerKeyLabel ? `Pinned to "${providerKeyLabel}" key` : 'Key pin cleared');
    } catch {
      // toast handled upstream
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
        <Show when={connectedProviders.state !== 'pending'}>
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

      <Show when={connectedProviders.state !== 'pending'} fallback={<RoutingLoadingSkeleton />}>
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
            headerRight={
              <button class="response-mode-btn" onClick={() => setResponseModeModalOpen(true)}>
                <span class="response-mode-btn__icon">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                Response mode: {defaultResponseMode() === 'stream' ? 'Stream' : 'Buffered'}
              </button>
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
                  tiersLoading={tiers.state === 'pending'}
                  changingTier={actions.changingTier}
                  resettingTier={actions.resettingTier}
                  resettingAll={actions.resettingAll}
                  addingFallback={actions.addingFallback}
                  onDropdownOpen={(tierId) => setDropdownTier(tierId)}
                  onOverride={handleOverride}
                  onPinKey={actions.handlePinKey}
                  onReset={actions.handleReset}
                  onFallbackUpdate={actions.handleFallbackUpdate}
                  onAddFallback={(tierId) => setFallbackPickerTier(tierId)}
                  getFallbacksFor={actions.getFallbacksFor}
                  getTier={actions.getTier}
                  complexityEnabled={complexityEnabled}
                  togglingComplexity={togglingComplexity}
                  onToggleComplexity={handleToggleComplexity}
                  responseMode={defaultResponseMode}
                  changingResponseMode={changingDefaultResponseMode}
                  onResponseModeChange={handleDefaultResponseModeChange}
                  embedded
                  getModelParams={getModelParamsFor}
                  setModelParams={setModelParamsFor}
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
                  onPinKey={handleSpecificityPinKey}
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
                  onFallbackUpdate={(category, _updatedFallbacks, updatedRoutes) => {
                    // Optimistic local state mutation only. Persistence is
                    // handled by RoutingTierCard via persistFallbacks (with
                    // routes), so a second network call here would race the
                    // first and drop route metadata for ambiguous models.
                    if (updatedRoutes === undefined) return;
                    mutateSpecificity((prev) =>
                      prev?.map((a) =>
                        a.category === category ? { ...a, fallback_routes: updatedRoutes } : a,
                      ),
                    );
                  }}
                  onAddFallback={(category) => setFallbackPickerTier(category)}
                  responseMode={specificityResponseMode}
                  changingResponseMode={changingSpecificityResponseMode}
                  onResponseModeChange={handleSpecificityResponseModeChange}
                  refetchAll={refetchAll}
                  refetchSpecificity={() => refetchSpecificity() as unknown as Promise<void>}
                  embedded
                  getModelParams={getModelParamsFor}
                  setModelParams={setModelParamsFor}
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
                  externalMutate={mutateHeaderTiers}
                  embedded
                  getModelParams={getModelParamsFor}
                  setModelParams={setModelParamsFor}
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
            onShowHowRoutingWorks={() => setHelpOpen(true)}
          />

          <Show when={helpOpen()}>
            {(() => {
              const content = buildPipelineHelp(
                hasAnySpecificityActive(),
                hasCustomTiersEnabled(),
                complexityEnabled(),
              );
              if (!content) return null;
              return (
                <div
                  class="modal-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setHelpOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setHelpOpen(false);
                  }}
                >
                  <div
                    class="modal-card"
                    style="max-width: 480px;"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 style="margin: 0 0 16px; font-size: var(--font-size-lg); font-weight: 600;">
                      How routing works
                    </h2>
                    {content}
                    <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
                      <button class="btn btn--primary btn--sm" onClick={() => setHelpOpen(false)}>
                        Got it
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Show>
        </Show>
      </Show>

      <Show when={responseModeModalOpen()}>
        <ResponseModeModal
          responseMode={defaultResponseMode}
          onResponseModeChange={async (mode) => {
            await handleDefaultResponseModeChange(mode);
          }}
          disabled={changingDefaultResponseMode}
          tiers={tiers() ?? []}
          models={models() ?? []}
          onClose={() => setResponseModeModalOpen(false)}
          onReplace={(tierId) => {
            setResponseModeModalOpen(false);
            setDropdownTier(tierId);
          }}
        />
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
        onProviderPoll={handleProviderPoll}
        onOpenProviderModal={openProviderModal}
      />
    </div>
  );
};

export default Routing;
