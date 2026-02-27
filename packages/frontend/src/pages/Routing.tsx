import { createSignal, createResource, For, Show, type Component } from "solid-js";
import { useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { STAGES, PROVIDERS, getModelLabel } from "../services/providers.js";
import { providerIcon } from "../components/ProviderIcon.js";
import ProviderSelectModal from "../components/ProviderSelectModal.js";
import RoutingInstructionModal from "../components/RoutingInstructionModal.js";
import ModelPickerModal from "../components/ModelPickerModal.js";
import { toast } from "../services/toast-store.js";
import { pricePerM, resolveProviderId } from "../services/routing-utils.js";
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  deactivateAllProviders,
  overrideTier,
  resetTier,
  resetAllTiers,
  type TierAssignment,
  type AvailableModel,
} from "../services/api.js";

function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m = apiModels.find((x) => x.model_name === model)
    ?? apiModels.find((x) => x.model_name.startsWith(model + "-"));
  if (m) return resolveProviderId(m.provider);
  for (const prov of PROVIDERS) {
    if (prov.models.some((pm) => pm.value === model || model.startsWith(pm.value + "-") || pm.value.startsWith(model + "-"))) {
      return prov.id;
    }
  }
  return undefined;
}

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [tiers, { refetch: refetchTiers }] = createResource(getTierAssignments);
  const [models, { refetch: refetchModels }] = createResource(getAvailableModels);
  const [connectedProviders, { refetch: refetchProviders }] = createResource(getProviders);
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [showProviderModal, setShowProviderModal] = createSignal(false);
  const [disabling, setDisabling] = createSignal(false);
  const [confirmDisable, setConfirmDisable] = createSignal(false);
  const [instructionModal, setInstructionModal] = createSignal<"enable" | "disable" | null>(null);

  const isEnabled = () =>
    connectedProviders()?.some((p) => p.is_active) ?? false;

  const activeProviderIds = () =>
    connectedProviders()?.filter((p) => p.is_active).map((p) => p.provider) ?? [];

  const getTier = (tierId: string): TierAssignment | undefined =>
    tiers()?.find((t) => t.tier === tierId);

  const effectiveModel = (t: TierAssignment): string | null =>
    t.override_model ?? t.auto_assigned_model;

  const modelInfo = (modelName: string): AvailableModel | undefined => {
    const all = models() ?? [];
    return all.find((m) => m.model_name === modelName)
      ?? all.find((m) => m.model_name.startsWith(modelName + "-"));
  };

  const labelFor = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (info) {
      const provId = resolveProviderId(info.provider);
      if (provId) return getModelLabel(provId, modelName);
    }
    return modelName;
  };

  const priceLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return "";
    return `${pricePerM(info.input_price_per_token)} in · ${pricePerM(info.output_price_per_token)} out per 1M`;
  };

  const handleOverride = async (tierId: string, modelName: string) => {
    setDropdownTier(null);
    try {
      await overrideTier(tierId, modelName);
      await refetchTiers();
      toast.success("Routing updated");
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleReset = async (tierId: string) => {
    try {
      await resetTier(tierId);
      await refetchTiers();
      toast.success("Reset to auto");
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleResetAll = async () => {
    try {
      await resetAllTiers();
      await refetchTiers();
      toast.success("All tiers reset to auto");
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleEnable = () => setShowProviderModal(true);

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await deactivateAllProviders();
      await Promise.all([refetchProviders(), refetchTiers(), refetchModels()]);
      setInstructionModal("disable");
    } catch {
      // error toast from fetchMutate
    } finally {
      setDisabling(false);
    }
  };

  const handleProviderUpdate = async () => {
    const wasEnabled = isEnabled();
    await Promise.all([refetchProviders(), refetchTiers(), refetchModels()]);
    if (!wasEnabled && isEnabled()) {
      setInstructionModal("enable");
    }
  };

  const hasOverrides = () => tiers()?.some((t) => t.override_model !== null) ?? false;

  return (
    <div class="container--md">
      <Title>{agentName()} Routing - Manifest</Title>
      <Meta name="description" content={`Configure model routing for ${agentName()}.`} />

      <div class="page-header routing-page-header">
        <div>
          <h1>Routing</h1>
          <span class="breadcrumb">{agentName()} &rsaquo; Assign a model to each tier</span>
        </div>
        <Show when={isEnabled()}>
          <button class="btn btn--primary btn--sm" onClick={() => setShowProviderModal(true)}>
            Connect providers
          </button>
        </Show>
      </div>

      <Show when={!tiers.loading && !connectedProviders.loading} fallback={
        <div class="panel" style="padding: var(--gap-xl);">
          <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
        </div>
      }>
        <Show
          when={isEnabled()}
          fallback={
            <div class="routing-enable-card">
              <div class="routing-enable-card__icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 class="routing-enable-card__title">Smart model routing</h2>
              <p class="routing-enable-card__desc">
                Automatically assign the best model to each complexity tier.
                Select which providers you want to use and Manifest will optimize your routing.
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
              {activeProviderIds().length} provider{activeProviderIds().length !== 1 ? "s" : ""}
            </span>
          </div>

          <div class="routing-cards">
            <For each={STAGES}>
              {(stage) => {
                const tier = () => getTier(stage.id);
                const eff = () => { const t = tier(); return t ? effectiveModel(t) : null; };
                const isManual = () => tier()?.override_model !== null && tier()?.override_model !== undefined;

                return (
                  <div class="routing-card">
                    <div class="routing-card__header">
                      <span class="routing-card__tier">{stage.label}</span>
                      <span class="routing-card__desc">{stage.desc}</span>
                    </div>
                    <div class="routing-card__body">
                      <Show when={eff()} fallback={
                        <div class="routing-card__empty">
                          <span class="routing-card__empty-text">No model available</span>
                          <button class="routing-card__empty-link" onClick={() => setDropdownTier(stage.id)}>Select model</button>
                        </div>
                      }>
                        {(modelName) => (<>
                          <div class="routing-card__override">
                            {(() => {
                              const provId = providerIdForModel(modelName(), models() ?? []);
                              return (<Show when={provId}>{(pid) => (<span class="routing-card__override-icon">{providerIcon(pid(), 16)}</span>)}</Show>);
                            })()}
                            <span class="routing-card__main">{labelFor(modelName())}</span>
                            <Show when={!isManual()}><span class="routing-card__auto-tag">auto</span></Show>
                          </div>
                          <span class="routing-card__sub">{priceLabel(modelName())}</span>
                        </>)}
                      </Show>
                    </div>
                    <Show when={eff()}>
                      <div class="routing-card__actions">
                        <Show when={isManual()} fallback={
                          <button class="routing-action" onClick={() => setDropdownTier(stage.id)}>Override</button>
                        }>
                          <button class="routing-action" onClick={() => setDropdownTier(stage.id)}>Edit</button>
                          <button class="routing-action" onClick={() => handleReset(stage.id)}>Reset</button>
                        </Show>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>

          <div class="routing-footer">
            <button class="routing-disable-btn" onClick={() => setConfirmDisable(true)} disabled={disabling()}>
              {disabling() ? "Disabling..." : "Disable Routing"}
            </button>
            <Show when={hasOverrides()}>
              <button class="btn btn--outline" style="font-size: var(--font-size-sm);" onClick={handleResetAll}>
                Reset all to auto
              </button>
            </Show>
            <div style="flex: 1;" />
            <button class="routing-footer__instructions" onClick={() => setInstructionModal("enable")}>
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
            onSelect={handleOverride}
            onClose={() => setDropdownTier(null)}
          />
        )}
      </Show>

      <Show when={showProviderModal()}>
        <ProviderSelectModal
          providers={connectedProviders() ?? []}
          onClose={() => setShowProviderModal(false)}
          onUpdate={handleProviderUpdate}
        />
      </Show>

      <RoutingInstructionModal
        open={instructionModal() !== null}
        mode={instructionModal() ?? "enable"}
        onClose={() => setInstructionModal(null)}
      />

      <Show when={confirmDisable()}>
        <div
          class="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDisable(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setConfirmDisable(false); }}
        >
          <div class="modal-card" style="max-width: 420px;">
            <h2 style="margin: 0 0 12px; font-size: var(--font-size-lg); font-weight: 600;">
              Disable routing?
            </h2>
            <p style="margin: 0 0 20px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
              All saved API keys and tier assignments will be removed. You will need to reconnect your providers if you re-enable routing later.
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
                {disabling() ? "Disabling..." : "Disable"}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Routing;
