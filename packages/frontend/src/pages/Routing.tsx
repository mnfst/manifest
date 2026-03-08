import { createSignal, createResource, For, Show, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { STAGES, PROVIDERS, getModelLabel } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.js';
import ProviderSelectModal from '../components/ProviderSelectModal.js';
import RoutingInstructionModal from '../components/RoutingInstructionModal.js';
import ModelPickerModal from '../components/ModelPickerModal.js';
import { toast } from '../services/toast-store.js';
import { pricePerM, resolveProviderId } from '../services/routing-utils.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import FallbackList from '../components/FallbackList.js';
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
  type TierAssignment,
  type AvailableModel,
} from '../services/api.js';

function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m =
    apiModels.find((x) => x.model_name === model) ??
    apiModels.find((x) => x.model_name.startsWith(model + '-'));
  if (m) return resolveProviderId(m.provider);
  for (const prov of PROVIDERS) {
    if (
      prov.models.some(
        (pm) =>
          pm.value === model ||
          model.startsWith(pm.value + '-') ||
          pm.value.startsWith(model + '-'),
      )
    ) {
      return prov.id;
    }
  }
  return undefined;
}

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

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
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [showProviderModal, setShowProviderModal] = createSignal(false);
  const [disabling, setDisabling] = createSignal(false);
  const [confirmDisable, setConfirmDisable] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
  const [resettingTier, setResettingTier] = createSignal<string | null>(null);
  const [changingTier, setChangingTier] = createSignal<string | null>(null);
  const [resettingAll, setResettingAll] = createSignal(false);
  const [fallbackPickerTier, setFallbackPickerTier] = createSignal<string | null>(null);
  const [addingFallback, setAddingFallback] = createSignal<string | null>(null);
  const [fallbackOverrides, setFallbackOverrides] = createSignal<Record<string, string[]>>({});

  const getFallbacksFor = (tierId: string): string[] => {
    const overrides = fallbackOverrides();
    if (tierId in overrides) return overrides[tierId]!;
    return getTier(tierId)?.fallback_models ?? [];
  };

  const isEnabled = () => connectedProviders()?.some((p) => p.is_active) ?? false;

  const activeProviderIds = () =>
    connectedProviders()
      ?.filter((p) => p.is_active)
      .map((p) => p.provider) ?? [];

  const getTier = (tierId: string): TierAssignment | undefined =>
    tiers()?.find((t) => t.tier === tierId);

  const effectiveModel = (t: TierAssignment): string | null =>
    t.override_model ?? t.auto_assigned_model;

  const modelInfo = (modelName: string): AvailableModel | undefined => {
    const all = models() ?? [];
    return (
      all.find((m) => m.model_name === modelName) ??
      all.find((m) => m.model_name.startsWith(modelName + '-'))
    );
  };

  const labelFor = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (info) {
      // Custom models: show "providerName / rawModelName"
      if (info.display_name) {
        const provName = info.provider_display_name;
        return provName ? `${provName} / ${info.display_name}` : info.display_name;
      }
      const provId = resolveProviderId(info.provider);
      if (provId) return getModelLabel(provId, modelName);
    }
    return modelName;
  };

  const priceLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return '';
    return `${pricePerM(info.input_price_per_token)} in · ${pricePerM(info.output_price_per_token)} out per 1M`;
  };

  const handleOverride = async (tierId: string, modelName: string) => {
    setDropdownTier(null);
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(agentName(), tierId, modelName);
      mutateTiers((prev) => prev?.map((t) => (t.tier === tierId ? updated : t)));
      toast.success('Routing updated');
    } catch {
      // error toast from fetchMutate
    } finally {
      setChangingTier(null);
    }
  };

  const handleReset = async (tierId: string) => {
    setResettingTier(tierId);
    try {
      await resetTier(agentName(), tierId);
      mutateTiers((prev) =>
        prev?.map((t) => (t.tier === tierId ? { ...t, override_model: null } : t)),
      );
      toast.success('Reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingTier(null);
    }
  };

  const handleResetAll = async () => {
    setResettingAll(true);
    try {
      await resetAllTiers(agentName());
      mutateTiers((prev) => prev?.map((t) => ({ ...t, override_model: null })));
      toast.success('All tiers reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingAll(false);
    }
  };

  const handleAddFallback = async (tierId: string, modelName: string) => {
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

  const handleEnable = () => setShowProviderModal(true);

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await deactivateAllProviders(agentName());
      await Promise.all([
        refetchProviders(),
        refetchCustomProviders(),
        refetchTiers(),
        refetchModels(),
      ]);
      setInstructionModal('disable');
    } catch {
      // error toast from fetchMutate
    } finally {
      setDisabling(false);
    }
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
      setInstructionModal('enable');
    }
  };

  const hasOverrides = () => tiers()?.some((t) => t.override_model !== null) ?? false;

  return (
    <div class="container--md">
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
        <Show when={isEnabled()}>
          <button class="btn btn--primary btn--sm" onClick={() => setShowProviderModal(true)}>
            Connect providers
          </button>
        </Show>
      </div>

      <Show
        when={!tiers.loading && !connectedProviders.loading}
        fallback={
          <div class="panel" style="padding: var(--gap-xl);">
            <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
          </div>
        }
      >
        <Show
          when={isEnabled()}
          fallback={
            <div class="routing-enable-card">
              <div class="routing-enable-card__icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 class="routing-enable-card__title">Smart model routing</h2>
              <p class="routing-enable-card__desc">
                Send simple tasks to cheap models, complex ones to better models. Connect your LLM
                providers to get started.
              </p>
              <button class="btn btn--primary" onClick={handleEnable}>
                Enable Routing
              </button>
            </div>
          }
        >
          <div class="routing-providers-info">
            <span class="routing-providers-info__icons">
              <For each={activeProviderIds()}>
                {(provId) => {
                  if (provId.startsWith('custom:')) {
                    const cp = customProviders()?.find((c) => `custom:${c.id}` === provId);
                    const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                    return (
                      <span class="routing-providers-info__icon" title={cp?.name ?? provId}>
                        <span
                          class="provider-card__logo-letter"
                          style={{
                            background: 'var(--custom-provider-color)',
                            width: '16px',
                            height: '16px',
                            'font-size': '9px',
                            'border-radius': '50%',
                          }}
                        >
                          {letter}
                        </span>
                      </span>
                    );
                  }
                  const provDef = PROVIDERS.find((p) => p.id === provId);
                  return (
                    <span class="routing-providers-info__icon" title={provDef?.name ?? provId}>
                      {providerIcon(provId, 16)}
                    </span>
                  );
                }}
              </For>
            </span>
            <span class="routing-providers-info__label">
              {activeProviderIds().length} provider{activeProviderIds().length !== 1 ? 's' : ''}
            </span>
          </div>

          <div class="routing-cards">
            <For each={STAGES}>
              {(stage) => {
                const tier = () => getTier(stage.id);
                const eff = () => {
                  const t = tier();
                  return t ? effectiveModel(t) : null;
                };
                const isManual = () =>
                  tier()?.override_model !== null && tier()?.override_model !== undefined;

                return (
                  <div class="routing-card">
                    <div class="routing-card__header">
                      <span class="routing-card__tier">{stage.label}</span>
                      <span class="routing-card__desc">{stage.desc}</span>
                    </div>
                    <div class="routing-card__body">
                      <Show
                        when={eff()}
                        fallback={
                          <div class="routing-card__empty">
                            <span class="routing-card__empty-text">No model available</span>
                            <button
                              class="routing-card__empty-link"
                              onClick={() => setDropdownTier(stage.id)}
                            >
                              Select model
                            </button>
                          </div>
                        }
                      >
                        {(modelName) => (
                          <>
                            <div class="routing-card__override">
                              {(() => {
                                const provId = providerIdForModel(modelName(), models() ?? []);
                                if (provId?.startsWith('custom:')) {
                                  const cp = customProviders()?.find(
                                    (c) => `custom:${c.id}` === provId,
                                  );
                                  const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                                  return (
                                    <span class="routing-card__override-icon">
                                      <span
                                        class="provider-card__logo-letter"
                                        style={{
                                          background: 'var(--custom-provider-color)',
                                          width: '16px',
                                          height: '16px',
                                          'font-size': '9px',
                                          'border-radius': '50%',
                                        }}
                                      >
                                        {letter}
                                      </span>
                                    </span>
                                  );
                                }
                                return (
                                  <Show when={provId}>
                                    {(pid) => (
                                      <span class="routing-card__override-icon">
                                        {providerIcon(pid(), 16)}
                                      </span>
                                    )}
                                  </Show>
                                );
                              })()}
                              <span class="routing-card__main">{labelFor(modelName())}</span>
                              <Show when={!isManual()}>
                                <span class="routing-card__auto-tag">auto</span>
                              </Show>
                            </div>
                            <span class="routing-card__sub">{priceLabel(modelName())}</span>
                          </>
                        )}
                      </Show>
                    </div>
                    <Show when={eff()}>
                      <div class="routing-card__right">
                        <div class="routing-card__actions">
                          <button
                            class="routing-action"
                            onClick={() => setDropdownTier(stage.id)}
                            disabled={changingTier() === stage.id}
                          >
                            {changingTier() === stage.id ? 'Changing...' : 'Change'}
                          </button>
                          <Show when={isManual()}>
                            <button
                              class="routing-action"
                              onClick={() => handleReset(stage.id)}
                              disabled={resettingTier() === stage.id || resettingAll()}
                            >
                              {resettingTier() === stage.id ? 'Resetting...' : 'Reset'}
                            </button>
                          </Show>
                        </div>
                        <FallbackList
                          agentName={agentName()}
                          tier={stage.id}
                          fallbacks={getFallbacksFor(stage.id)}
                          models={models() ?? []}
                          customProviders={customProviders() ?? []}
                          onUpdate={(updatedFallbacks) => {
                            setFallbackOverrides((prev) => {
                              const next = { ...prev };
                              delete next[stage.id];
                              return next;
                            });
                            mutateTiers((prev) =>
                              prev?.map((t) =>
                                t.tier === stage.id
                                  ? { ...t, fallback_models: updatedFallbacks }
                                  : t,
                              ),
                            );
                          }}
                          onAddFallback={() => setFallbackPickerTier(stage.id)}
                          adding={addingFallback() === stage.id}
                        />
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>

          <div class="routing-footer">
            <button
              class="routing-disable-btn"
              onClick={() => setConfirmDisable(true)}
              disabled={disabling()}
            >
              {disabling() ? 'Disabling...' : 'Disable Routing'}
            </button>
            <Show when={hasOverrides()}>
              <button
                class="btn btn--outline"
                style="font-size: var(--font-size-sm);"
                onClick={handleResetAll}
                disabled={resettingAll() || resettingTier() !== null}
              >
                {resettingAll() ? 'Resetting...' : 'Reset all to auto'}
              </button>
            </Show>
            <div style="flex: 1;" />
            <button
              class="routing-footer__instructions"
              onClick={() => setInstructionModal('enable')}
            >
              Setup instructions
            </button>
          </div>
        </Show>
      </Show>

      <Show when={dropdownTier()}>
        {(tierId) => (
          <ModelPickerModal
            tierId={tierId()}
            models={models() ?? []}
            tiers={tiers() ?? []}
            customProviders={customProviders() ?? []}
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
        onClose={() => setInstructionModal(null)}
      />

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
          <div class="modal-card" style="max-width: 420px;">
            <h2 style="margin: 0 0 12px; font-size: var(--font-size-lg); font-weight: 600;">
              Disable routing?
            </h2>
            <p style="margin: 0 0 20px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              All provider API keys and tier-to-model assignments will be permanently removed. If
              you re-enable routing later, you will need to reconnect your providers and reconfigure
              each tier.
            </p>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button class="btn btn--outline" onClick={() => setConfirmDisable(false)}>
                Cancel
              </button>
              <button
                class="btn btn--danger"
                disabled={disabling()}
                onClick={async () => {
                  setConfirmDisable(false);
                  await handleDisable();
                }}
              >
                {disabling() ? 'Disabling...' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Routing;
