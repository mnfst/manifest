import { createSignal, createResource, For, Show, type Component } from 'solid-js';
import { useLocation, useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { STAGES } from '../services/providers.js';
import ProviderSelectModal from '../components/ProviderSelectModal.js';
import RoutingInstructionModal from '../components/RoutingInstructionModal.js';
import ModelPickerModal from '../components/ModelPickerModal.js';
import { toast } from '../services/toast-store.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import RoutingTierCard from './RoutingTierCard.js';
import {
  RoutingLoadingSkeleton,
  EnableRoutingCard,
  ActiveProviderIcons,
  RoutingFooter,
  DisableRoutingModal,
} from './RoutingPanels.js';
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  getCustomProviders,
  deactivateAllProviders,
  overrideTier,
  resetTier,
  resetAllTiers,
  setFallbacks,
  refreshModels,
  type TierAssignment,
  type AuthType,
} from '../services/api.js';

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ openProviders?: boolean }>();
  const agentName = () => decodeURIComponent(params.agentName);

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
    !!(location.state as { openProviders?: boolean } | undefined)?.openProviders,
  );
  const [disabling, setDisabling] = createSignal(false);
  const [confirmDisable, setConfirmDisable] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
  const [instructionProvider, setInstructionProvider] = createSignal<string | null>(null);
  const [changingTier, setChangingTier] = createSignal<string | null>(null);
  const [resettingAll, setResettingAll] = createSignal(false);
  const [resettingTier, setResettingTier] = createSignal<string | null>(null);
  const [confirmResetTier, setConfirmResetTier] = createSignal<string | null>(null);
  const [fallbackPickerTier, setFallbackPickerTier] = createSignal<string | null>(null);
  const [addingFallback, setAddingFallback] = createSignal<string | null>(null);
  const [fallbackOverrides, setFallbackOverrides] = createSignal<Record<string, string[]>>({});
  const [refreshingModels, setRefreshingModels] = createSignal(false);

  const getFallbacksFor = (tierId: string): string[] => {
    const overrides = fallbackOverrides();
    if (tierId in overrides) return overrides[tierId]!;
    return getTier(tierId)?.fallback_models ?? [];
  };
  const isEnabled = () => connectedProviders()?.some((p) => p.is_active) ?? false;
  const activeProviders = () => connectedProviders()?.filter((p) => p.is_active) ?? [];

  const getTier = (tierId: string): TierAssignment | undefined =>
    tiers()?.find((t) => t.tier === tierId);
  const handleOverride = async (
    tierId: string,
    modelName: string,
    providerId: string,
    authType?: AuthType,
  ) => {
    setDropdownTier(null);
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(agentName(), tierId, modelName, providerId, authType);
      mutateTiers((prev) => prev?.map((t) => (t.tier === tierId ? updated : t)));
      toast.success('Routing updated');
    } catch {
      // error toast from fetchMutate
    } finally {
      setChangingTier(null);
    }
  };

  const handleResetAll = async () => {
    setResettingAll(true);
    try {
      await resetAllTiers(agentName());
      mutateTiers((prev) =>
        prev?.map((t) => ({ ...t, override_model: null, override_provider: null })),
      );
      toast.success('All tiers reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingAll(false);
    }
  };

  const handleReset = async (tierId: string) => {
    setConfirmResetTier(null);
    setResettingTier(tierId);
    try {
      await resetTier(agentName(), tierId);
      mutateTiers((prev) =>
        prev?.map((t) =>
          t.tier === tierId
            ? { ...t, override_model: null, override_provider: null, fallback_models: [] }
            : t,
        ),
      );
      toast.success('Tier reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingTier(null);
    }
  };

  const handleAddFallback = async (
    tierId: string,
    modelName: string,
    _providerId: string,
    _authType?: AuthType,
  ) => {
    setFallbackPickerTier(null);
    const tier = getTier(tierId);
    const current = tier?.fallback_models ?? [];
    if (current.includes(modelName)) return;
    const updated = [...current, modelName];
    setFallbackOverrides((prev) => ({ ...prev, [tierId]: updated }));
    setAddingFallback(tierId);
    try {
      await setFallbacks(agentName(), tierId, updated);
      mutateTiers((prev) =>
        prev?.map((t) => (t.tier === tierId ? { ...t, fallback_models: updated } : t)),
      );
      toast.success('Fallback added');
    } catch {
      setFallbackOverrides((prev) => {
        const next = { ...prev };
        delete next[tierId];
        return next;
      });
    } finally {
      setAddingFallback(null);
      setFallbackOverrides((prev) => {
        const next = { ...prev };
        delete next[tierId];
        return next;
      });
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    const prevProviders = connectedProviders();
    mutateProviders((prev) => prev?.map((p) => ({ ...p, is_active: false })));
    try {
      await deactivateAllProviders(agentName());
    } catch {
      mutateProviders(prevProviders);
      setDisabling(false);
      return;
    }
    await Promise.all([
      refetchProviders(),
      refetchCustomProviders(),
      refetchTiers(),
      refetchModels(),
    ]).catch(() => {});
    setInstructionModal('disable');
    setDisabling(false);
  };

  const handleProviderUpdate = async () => {
    const wasEnabled = isEnabled();
    await Promise.all([
      refetchProviders(),
      refetchCustomProviders(),
      refetchTiers(),
      refetchModels(),
    ]);
    if (!wasEnabled && isEnabled()) {
      const firstProvider = activeProviders()[0];
      setInstructionProvider(firstProvider?.provider ?? null);
      setInstructionModal('enable');
    }
  };

  const handleFallbackUpdate = (tierId: string, updatedFallbacks: string[]) => {
    setFallbackOverrides((prev) => {
      const next = { ...prev };
      delete next[tierId];
      return next;
    });
    mutateTiers((prev) =>
      prev?.map((t) => (t.tier === tierId ? { ...t, fallback_models: updatedFallbacks } : t)),
    );
  };
  const hasOverrides = () => tiers()?.some((t) => t.override_model !== null) ?? false;

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
            <button class="btn btn--primary btn--sm" onClick={() => setShowProviderModal(true)}>
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
                <span class="spinner" style="width: 24px; height: 24px;" />
              </div>
            }
          >
            <RoutingLoadingSkeleton />
          </Show>
        }
      >
        <Show
          when={isEnabled()}
          fallback={<EnableRoutingCard onEnable={() => setShowProviderModal(true)} />}
        >
          <ActiveProviderIcons
            activeProviders={activeProviders}
            customProviders={() => customProviders() ?? []}
          />

          <div class="routing-cards">
            <For each={STAGES}>
              {(stage) => (
                <RoutingTierCard
                  stage={stage}
                  tier={() => getTier(stage.id)}
                  models={() => models() ?? []}
                  customProviders={() => customProviders() ?? []}
                  activeProviders={activeProviders}
                  tiersLoading={tiers.loading}
                  changingTier={changingTier}
                  resettingTier={resettingTier}
                  resettingAll={resettingAll}
                  addingFallback={addingFallback}
                  agentName={agentName}
                  onDropdownOpen={(tierId) => setDropdownTier(tierId)}
                  onOverride={handleOverride}
                  onReset={handleReset}
                  onFallbackUpdate={handleFallbackUpdate}
                  onAddFallback={(tierId) => setFallbackPickerTier(tierId)}
                  getFallbacksFor={getFallbacksFor}
                  connectedProviders={() => connectedProviders() ?? []}
                />
              )}
            </For>
          </div>

          <RoutingFooter
            disabling={disabling}
            hasOverrides={hasOverrides}
            resettingAll={resettingAll}
            resettingTier={resettingTier}
            onDisable={() => setConfirmDisable(true)}
            onResetAll={handleResetAll}
            onShowInstructions={() => setInstructionModal('enable')}
          />
        </Show>
      </Show>

      <Show when={dropdownTier()}>
        {(tierId) => (
          <ModelPickerModal
            tierId={tierId()}
            models={models() ?? []}
            tiers={tiers() ?? []}
            customProviders={customProviders() ?? []}
            connectedProviders={connectedProviders() ?? []}
            onSelect={handleOverride}
            onClose={() => setDropdownTier(null)}
          />
        )}
      </Show>

      <Show when={fallbackPickerTier()}>
        {(tierId) => {
          const currentFallbacks = () => getTier(tierId())?.fallback_models ?? [];
          const effectiveModel = () => {
            const t = getTier(tierId());
            return t ? (t.override_model ?? t.auto_assigned_model) : null;
          };
          const filteredModels = () =>
            (models() ?? []).filter(
              (m) =>
                m.model_name !== effectiveModel() && !currentFallbacks().includes(m.model_name),
            );
          return (
            <ModelPickerModal
              tierId={tierId()}
              models={filteredModels()}
              tiers={tiers() ?? []}
              customProviders={customProviders() ?? []}
              connectedProviders={connectedProviders() ?? []}
              onSelect={handleAddFallback}
              onClose={() => setFallbackPickerTier(null)}
            />
          );
        }}
      </Show>

      <Show when={showProviderModal()}>
        <ProviderSelectModal
          agentName={agentName()}
          providers={connectedProviders() ?? []}
          customProviders={customProviders() ?? []}
          onClose={() => setShowProviderModal(false)}
          onUpdate={handleProviderUpdate}
        />
      </Show>

      <RoutingInstructionModal
        open={instructionModal() !== null}
        mode={instructionModal() ?? 'enable'}
        connectedProvider={instructionProvider()}
        onClose={() => {
          setInstructionModal(null);
          setInstructionProvider(null);
        }}
      />

      <DisableRoutingModal
        open={confirmDisable()}
        disabling={disabling}
        onCancel={() => setConfirmDisable(false)}
        onConfirm={async () => {
          setConfirmDisable(false);
          await handleDisable();
        }}
      />
    </div>
  );
};

export default Routing;
