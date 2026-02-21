import { createSignal, createResource, For, Show, type Component } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { agentPath } from "../services/routing.js";
import { STAGES, PROVIDERS, getModelLabel, getProvider } from "../services/providers.js";
import { providerIcon } from "../components/ProviderIcon.js";
import { toast } from "../services/toast-store.js";
import {
  getTierAssignments,
  getAvailableModels,
  overrideTier,
  resetTier,
  resetAllTiers,
  type TierAssignment,
  type AvailableModel,
} from "../services/api.js";

/** Format per-million token price: $0.15 */
function pricePerM(perToken: number): string {
  const perM = Number(perToken) * 1_000_000;
  if (perM < 0.01) return "$0.00";
  if (perM < 1) return `$${perM.toFixed(2)}`;
  return `$${perM.toFixed(2)}`;
}

/** Find the provider id (lowercase) for a model_name from available models */
function providerIdForModel(model: string, models: AvailableModel[]): string | undefined {
  const m = models.find((x) => x.model_name === model);
  if (!m) return undefined;
  return PROVIDERS.find((p) => p.name.toLowerCase() === m.provider.toLowerCase())?.id;
}

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [tiers, { refetch: refetchTiers }] = createResource(getTierAssignments);
  const [models] = createResource(getAvailableModels);
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");

  const getTier = (tierId: string): TierAssignment | undefined =>
    tiers()?.find((t) => t.tier === tierId);

  const hasAnyModel = () =>
    tiers()?.some((t) => t.override_model || t.auto_assigned_model) ?? false;

  const effectiveModel = (t: TierAssignment): string | null =>
    t.override_model ?? t.auto_assigned_model;

  const modelInfo = (modelName: string): AvailableModel | undefined =>
    models()?.find((m) => m.model_name === modelName);

  /** Label for a model: try provider-based label first, fall back to model_name */
  const labelFor = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (info) {
      const provId = PROVIDERS.find(
        (p) => p.name.toLowerCase() === info.provider.toLowerCase(),
      )?.id;
      if (provId) return getModelLabel(provId, modelName);
    }
    return modelName;
  };

  const priceLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return "";
    return `${pricePerM(info.input_price_per_token)}/${pricePerM(info.output_price_per_token)} /M`;
  };

  /* ── Dropdown model list ── */
  const openDropdown = (tierId: string) => {
    setSearch("");
    setDropdownTier(tierId);
  };

  const closeDropdown = () => {
    setDropdownTier(null);
    setSearch("");
  };

  /** Group available models by provider, filtered by search */
  const groupedModels = () => {
    const allModels = models() ?? [];
    const q = search().toLowerCase().trim();

    const groups: { provId: string; name: string; models: AvailableModel[] }[] = [];
    const byProvider = new Map<string, AvailableModel[]>();

    for (const m of allModels) {
      const key = m.provider.toLowerCase();
      if (!byProvider.has(key)) byProvider.set(key, []);
      byProvider.get(key)!.push(m);
    }

    for (const prov of PROVIDERS) {
      const provModels = byProvider.get(prov.name.toLowerCase()) ?? [];
      if (provModels.length === 0) continue;

      // Sort by total price ascending
      const sorted = [...provModels].sort(
        (a, b) =>
          Number(a.input_price_per_token) + Number(a.output_price_per_token) -
          (Number(b.input_price_per_token) + Number(b.output_price_per_token)),
      );

      if (q) {
        const nameMatch = prov.name.toLowerCase().includes(q);
        const filtered = nameMatch
          ? sorted
          : sorted.filter(
              (m) =>
                m.model_name.toLowerCase().includes(q) ||
                labelFor(m.model_name).toLowerCase().includes(q),
            );
        if (filtered.length > 0) {
          groups.push({ provId: prov.id, name: prov.name, models: filtered });
        }
      } else {
        groups.push({ provId: prov.id, name: prov.name, models: sorted });
      }
    }

    return groups;
  };

  /** Mark a model as "(recommended)" if it's the auto-assigned model for this tier */
  const isRecommended = (tierId: string, modelName: string): boolean => {
    const t = getTier(tierId);
    return t?.auto_assigned_model === modelName;
  };

  const handleOverride = async (tierId: string, modelName: string) => {
    closeDropdown();
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

  const hasOverrides = () => tiers()?.some((t) => t.override_model !== null) ?? false;

  return (
    <div class="container--md">
      <Title>{agentName()} - Routing | Manifest</Title>
      <Meta name="description" content={`Configure model routing for ${agentName()}.`} />

      <div class="page-header">
        <div>
          <h1>Routing</h1>
          <span class="breadcrumb">{agentName()} &rsaquo; Assign a model to each tier</span>
        </div>
      </div>

      <Show when={!tiers.loading} fallback={
        <div class="panel" style="padding: var(--gap-xl);">
          <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
        </div>
      }>
        <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
          Models are automatically assigned based on your connected providers. Override any tier manually, or manage providers in{" "}
          <A href={agentPath(agentName(), "/settings")} style="color: hsl(var(--foreground)); font-weight: 600; text-decoration: underline;">Settings</A>.
        </p>

        <div class="routing-cards">
          <For each={STAGES}>
            {(stage) => {
              const tier = () => getTier(stage.id);
              const eff = () => {
                const t = tier();
                return t ? effectiveModel(t) : null;
              };
              const isManual = () => tier()?.override_model !== null && tier()?.override_model !== undefined;

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
                          <A
                            href={agentPath(agentName(), "/settings")}
                            class="routing-card__empty-link"
                          >
                            Connect a provider in Settings
                          </A>
                        </div>
                      }
                    >
                      {(modelName) => (
                        <Show
                          when={isManual()}
                          fallback={
                            <>
                              <span class="routing-card__main">Default model</span>
                              <span class="routing-card__sub">
                                {labelFor(modelName())} · {priceLabel(modelName())}
                              </span>
                            </>
                          }
                        >
                          <div class="routing-card__override">
                            {(() => {
                              const provId = providerIdForModel(modelName(), models() ?? []);
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
                          </div>
                          <span class="routing-card__sub">{priceLabel(modelName())}</span>
                        </Show>
                      )}
                    </Show>
                  </div>

                  <div class="routing-card__actions">
                    <Show
                      when={isManual()}
                      fallback={
                        <button class="routing-action" onClick={() => openDropdown(stage.id)}>
                          Override
                        </button>
                      }
                    >
                      <button class="routing-action" onClick={() => handleReset(stage.id)}>
                        Reset
                      </button>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        <Show when={hasOverrides()}>
          <div style="margin-top: var(--gap-lg); text-align: right;">
            <button class="btn btn--outline" style="font-size: var(--font-size-sm);" onClick={handleResetAll}>
              Reset all to auto
            </button>
          </div>
        </Show>
      </Show>

      {/* ── Model picker modal ─────────────────────────── */}
      <Show when={dropdownTier()}>
        {(tierId) => (
          <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDropdown(); }}>
            <div class="modal-card" style="max-width: 600px; padding: 0; display: flex; flex-direction: column; max-height: 80vh;">
              <div class="routing-modal__header">
                <div>
                  <div class="routing-modal__title">Select a model</div>
                  <div class="routing-modal__subtitle">
                    {STAGES.find((s) => s.id === tierId())?.label} tier
                  </div>
                </div>
                <button class="modal__close" onClick={closeDropdown}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <div class="routing-modal__search-wrap">
                <svg class="routing-modal__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  class="routing-modal__search"
                  type="text"
                  placeholder="Search models or providers..."
                  value={search()}
                  onInput={(e) => setSearch(e.currentTarget.value)}
                  autofocus
                />
              </div>

              <div class="routing-modal__list">
                <For each={groupedModels()}>
                  {(group) => (
                    <div class="routing-modal__group">
                      <div class="routing-modal__group-header">
                        <span class="routing-modal__group-icon">
                          {providerIcon(group.provId, 16)}
                        </span>
                        <span class="routing-modal__group-name">{group.name}</span>
                      </div>
                      <For each={group.models}>
                        {(model) => (
                          <button
                            class="routing-modal__model"
                            onClick={() => handleOverride(tierId(), model.model_name)}
                          >
                            <span class="routing-modal__model-label">
                              {labelFor(model.model_name)}
                              <Show when={isRecommended(tierId(), model.model_name)}>
                                <span class="routing-modal__recommended"> (recommended)</span>
                              </Show>
                            </span>
                            <span class="routing-modal__model-id">
                              {pricePerM(model.input_price_per_token)}/{pricePerM(model.output_price_per_token)} /M
                            </span>
                          </button>
                        )}
                      </For>
                    </div>
                  )}
                </For>
                <Show when={groupedModels().length === 0}>
                  <div class="routing-modal__empty">No models match your search.</div>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default Routing;
