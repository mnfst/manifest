import { createSignal, createResource, For, Show, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { STAGES, PROVIDERS } from '../services/providers.js';
import { getModelLabel } from '../services/provider-utils.js';
import { providerIcon } from '../components/ProviderIcon.js';
import { authBadgeFor } from '../components/AuthBadge.js';
import ProviderSelectModal from '../components/ProviderSelectModal.js';
import RoutingInstructionModal from '../components/RoutingInstructionModal.js';
import ModelPickerModal from '../components/ModelPickerModal.js';
import { toast } from '../services/toast-store.js';
import { pricePerM, resolveProviderId, inferProviderFromModel } from '../services/routing-utils.js';
import { customProviderColor } from '../services/formatters.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import FallbackList from '../components/FallbackList.js';
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  getCustomProviders,
  deactivateAllProviders,
  overrideTier,
  resetAllTiers,
  setFallbacks,
  type TierAssignment,
  type AvailableModel,
  type AuthType,
} from '../services/api.js';

function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m =
    apiModels.find((x) => x.model_name === model) ??
    apiModels.find((x) => x.model_name.startsWith(model + '-'));
  if (m) {
    // Prefer prefix-inferred provider (e.g. "anthropic" from "anthropic/claude-sonnet-4")
    // over the DB provider field (e.g. "openrouter" when all models come from OpenRouter)
    const prefixId = inferProviderFromModel(m.model_name);
    if (prefixId && PROVIDERS.find((p) => p.id === prefixId)) return prefixId;
    return resolveProviderId(m.provider) ?? prefixId;
  }
  // Try inferring from the model name directly
  const prefix = inferProviderFromModel(model);
  if (prefix && PROVIDERS.find((p) => p.id === prefix)) return prefix;
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
  const [connectedProviders, { refetch: refetchProviders, mutate: mutateProviders }] =
    createResource(() => agentName(), getProviders);
  const [customProviders, { refetch: refetchCustomProviders }] = createResource(
    () => agentName(),
    getCustomProviders,
  );
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [showProviderModal, setShowProviderModal] = createSignal(false);
  const [disabling, setDisabling] = createSignal(false);
  const [confirmDisable, setConfirmDisable] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
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

  const activeProviders = () => connectedProviders()?.filter((p) => p.is_active) ?? [];

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
      // Prefer prefix-inferred provider for label lookup
      const prefixId = inferProviderFromModel(modelName);
      const provId =
        prefixId && PROVIDERS.find((p) => p.id === prefixId)
          ? prefixId
          : resolveProviderId(info.provider);
      if (provId) return getModelLabel(provId, modelName);
    }
    return modelName;
  };

  const priceLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return '';
    return `${pricePerM(info.input_price_per_token)} in · ${pricePerM(info.output_price_per_token)} out per 1M`;
  };

  const handleOverride = async (tierId: string, modelName: string, authType?: AuthType) => {
    setDropdownTier(null);
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(agentName(), tierId, modelName, authType);
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
      mutateTiers((prev) => prev?.map((t) => ({ ...t, override_model: null })));
      toast.success('All tiers reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingAll(false);
    }
  };

  const handleAddFallback = async (tierId: string, modelName: string, _authType?: AuthType) => {
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
    // Optimistic: mark all providers inactive so the UI switches immediately
    const prevProviders = connectedProviders();
    mutateProviders((prev) => prev?.map((p) => ({ ...p, is_active: false })));
    try {
      await deactivateAllProviders(agentName());
    } catch {
      // Revert on failure only when the deactivation itself fails
      mutateProviders(prevProviders);
      setDisabling(false);
      return;
    }
    // Refetch in background — deactivation already succeeded so no revert needed
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
      // Only show setup instructions when a non-subscription provider is active,
      // since subscription models don't require OpenClaw routing configuration.
      const hasNonSub = activeProviders().some((p) => p.auth_type !== 'subscription');
      if (hasNonSub) setInstructionModal('enable');
    }
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
          <button class="btn btn--primary btn--sm" onClick={() => setShowProviderModal(true)}>
            Connect providers
          </button>
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
            <div class="routing-providers-info">
              <span class="routing-providers-info__icons">
                <span class="routing-providers-info__icon">
                  <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
                </span>
                <span class="routing-providers-info__icon">
                  <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
                </span>
              </span>
              <span class="routing-providers-info__label">
                <div class="skeleton skeleton--text" style="width: 80px;" />
              </span>
            </div>
            <div class="routing-cards">
              <For each={STAGES}>
                {(stage) => (
                  <div class="routing-card">
                    <div class="routing-card__header">
                      <span class="routing-card__tier">{stage.label}</span>
                    </div>
                    <div class="routing-card__body">
                      <div class="routing-card__override">
                        <span class="routing-card__override-icon">
                          <div
                            class="skeleton"
                            style="width: 16px; height: 16px; border-radius: 50%;"
                          />
                        </span>
                        <div class="skeleton skeleton--text" style="width: 80%; height: 14px;" />
                      </div>
                      <div
                        class="skeleton skeleton--text"
                        style="width: 60%; height: 12px; margin-top: 6px;"
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
            <div class="routing-footer">
              <div
                class="skeleton skeleton--text"
                style="width: 120px; height: 32px; border-radius: var(--radius);"
              />
              <div style="flex: 1;" />
              <div class="skeleton skeleton--text" style="width: 130px; height: 14px;" />
            </div>
          </Show>
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
              <For each={activeProviders()}>
                {(prov) => {
                  if (prov.provider.startsWith('custom:')) {
                    const cp = customProviders()?.find((c) => `custom:${c.id}` === prov.provider);
                    const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                    return (
                      <span class="routing-providers-info__icon" title={cp?.name ?? prov.provider}>
                        <span
                          class="provider-card__logo-letter"
                          style={{
                            background: customProviderColor(cp?.name ?? ''),
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
                  const provDef = PROVIDERS.find((p) => p.id === prov.provider);
                  const authLabel = prov.auth_type === 'subscription' ? 'Subscription' : 'API Key';
                  return (
                    <span
                      class="routing-providers-info__icon"
                      title={`${provDef?.name ?? prov.provider} (${authLabel})`}
                    >
                      {providerIcon(prov.provider, 16)}
                      {authBadgeFor(prov.auth_type, 12)}
                    </span>
                  );
                }}
              </For>
            </span>
            <span class="routing-providers-info__label">
              {activeProviders().length} connection{activeProviders().length !== 1 ? 's' : ''}
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
                    </div>
                    <Show
                      when={!tiers.loading}
                      fallback={
                        <div class="routing-card__body">
                          <div class="skeleton skeleton--text" style="width: 80%; height: 14px;" />
                          <div
                            class="skeleton skeleton--text"
                            style="width: 60%; height: 12px; margin-top: 6px;"
                          />
                        </div>
                      }
                    >
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
                          {(modelName) => {
                            const provId = () => providerIdForModel(modelName(), models() ?? []);
                            const effectiveAuth = (): AuthType | null => {
                              const t = tier();
                              if (t?.override_auth_type) return t.override_auth_type;
                              const id = provId();
                              if (!id) return null;
                              const provs = activeProviders().filter(
                                (p) => p.provider.toLowerCase() === id.toLowerCase(),
                              );
                              if (provs.some((p) => p.auth_type === 'subscription'))
                                return 'subscription';
                              if (provs.some((p) => p.auth_type === 'api_key')) return 'api_key';
                              return null;
                            };
                            return (
                              <Show
                                when={changingTier() !== stage.id}
                                fallback={
                                  <>
                                    <div class="routing-card__override">
                                      <div
                                        class="skeleton skeleton--text"
                                        style="width: 80%; height: 14px;"
                                      />
                                    </div>
                                    <div
                                      class="skeleton skeleton--text"
                                      style="width: 60%; height: 12px; margin-top: 6px;"
                                    />
                                  </>
                                }
                              >
                                <div class="routing-card__model-row">
                                  <div class="routing-card__override">
                                    {(() => {
                                      const pid = provId();
                                      if (pid?.startsWith('custom:')) {
                                        const cp = customProviders()?.find(
                                          (c) => `custom:${c.id}` === pid,
                                        );
                                        const letter = (cp?.name ?? 'C').charAt(0).toUpperCase();
                                        return (
                                          <span class="routing-card__override-icon">
                                            <span
                                              class="provider-card__logo-letter"
                                              style={{
                                                background: customProviderColor(cp?.name ?? ''),
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
                                        <Show when={pid}>
                                          {(p) => (
                                            <span class="routing-card__override-icon">
                                              {providerIcon(p(), 16)}
                                              {authBadgeFor(effectiveAuth(), 12)}
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
                                  <button
                                    class="btn btn--outline btn--sm"
                                    onClick={() => setDropdownTier(stage.id)}
                                  >
                                    Change
                                  </button>
                                </div>
                                <Show
                                  when={effectiveAuth() !== 'subscription'}
                                  fallback={
                                    <span class="routing-card__sub routing-card__sub--subscription">
                                      Included in subscription
                                    </span>
                                  }
                                >
                                  <span class="routing-card__sub">{priceLabel(modelName())}</span>
                                </Show>
                              </Show>
                            );
                          }}
                        </Show>
                      </div>
                      <Show when={eff()}>
                        <div class="routing-card__fallbacks">
                          <Show when={getFallbacksFor(stage.id).length > 0}>
                            <div class="routing-card__fallbacks-label">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path d="M6 22h2V8h4L7 2 2 8h4zM19 2h-2v14h-4l5 6 5-6h-4z" />
                              </svg>
                              Fallbacks
                            </div>
                          </Show>
                          <FallbackList
                            agentName={agentName()}
                            tier={stage.id}
                            fallbacks={getFallbacksFor(stage.id)}
                            models={models() ?? []}
                            customProviders={customProviders() ?? []}
                            connectedProviders={activeProviders()}
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
              {disabling() ? <span class="spinner" /> : 'Disable Routing'}
            </button>
            <Show when={hasOverrides()}>
              <button
                class="btn btn--outline"
                style="font-size: var(--font-size-sm);"
                onClick={handleResetAll}
                disabled={resettingAll()}
              >
                {resettingAll() ? <span class="spinner" /> : 'Reset all to auto'}
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
                {disabling() ? <span class="spinner" /> : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Routing;
