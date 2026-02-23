import { createSignal, createResource, For, Show, type Component } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { agentPath } from "../services/routing.js";
import { STAGES, PROVIDERS, getModelLabel, getProvider } from "../services/providers.js";
import { providerIcon } from "../components/ProviderIcon.js";
import { toast } from "../services/toast-store.js";
import InfoTooltip from "../components/InfoTooltip.js";
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
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

const CAPABILITY_LABELS: { key: keyof AvailableModel; label: string }[] = [
  { key: "capability_vision", label: "Multimodal" },
  { key: "capability_tool_calling", label: "Tool Calling" },
  { key: "capability_reasoning", label: "Reasoning" },
  { key: "capability_structured_output", label: "Structured Output" },
];

/** Map DB provider names to frontend provider IDs */
const PROVIDER_ALIASES: Record<string, string> = {
  google: "gemini",
  alibaba: "qwen",
  moonshot: "moonshot",
  meta: "meta",
  cohere: "cohere",
};

function resolveProviderId(dbProvider: string): string | undefined {
  const key = dbProvider.toLowerCase();
  const alias = PROVIDER_ALIASES[key];
  return PROVIDERS.find((p) => p.id === key || p.id === alias || p.name.toLowerCase() === key)?.id;
}

/** Find the provider id for a model — checks pricing API first, then PROVIDERS list */
function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  // Try pricing API data
  const m = apiModels.find((x) => x.model_name === model)
    ?? apiModels.find((x) => x.model_name.startsWith(model + "-"));
  if (m) return resolveProviderId(m.provider);
  // Fallback: search PROVIDERS model lists by value
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
  const [models] = createResource(getAvailableModels);
  const [connectedProviders] = createResource(getProviders);
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");

  const getTier = (tierId: string): TierAssignment | undefined =>
    tiers()?.find((t) => t.tier === tierId);

  const hasAnyModel = () =>
    tiers()?.some((t) => t.override_model || t.auto_assigned_model) ?? false;

  const effectiveModel = (t: TierAssignment): string | null =>
    t.override_model ?? t.auto_assigned_model;

  const modelInfo = (modelName: string): AvailableModel | undefined => {
    const all = models() ?? [];
    return all.find((m) => m.model_name === modelName)
      ?? all.find((m) => m.model_name.startsWith(modelName + "-"));
  };

  /** Label for a model: try provider-based label first, fall back to model_name */
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
    return `${pricePerM(info.input_price_per_token)} in · ${pricePerM(info.output_price_per_token)} out / 1M tokens`;
  };

  const capsLabel = (modelName: string): string => {
    const info = modelInfo(modelName);
    if (!info) return "";
    const active = CAPABILITY_LABELS.filter((c) => info[c.key] === true);
    return active.map((c) => c.label).join(" · ");
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

  /** Build a label lookup from PROVIDERS: model value → human label */
  const providerLabelMap = (): Map<string, string> => {
    const map = new Map<string, string>();
    for (const prov of PROVIDERS) {
      for (const m of prov.models) {
        map.set(m.value, m.label);
      }
    }
    return map;
  };

  /** Group models from the pricing API (source of truth), filtered by search */
  const groupedModels = () => {
    const q = search().toLowerCase().trim();
    const labels = providerLabelMap();

    type ModalModel = { value: string; label: string; pricing: AvailableModel };
    const groupMap = new Map<string, { provId: string; name: string; models: ModalModel[] }>();

    for (const m of models() ?? []) {
      const provId = resolveProviderId(m.provider);
      if (!provId) continue;

      if (!groupMap.has(provId)) {
        const provDef = PROVIDERS.find((p) => p.id === provId);
        groupMap.set(provId, { provId, name: provDef?.name ?? m.provider, models: [] });
      }

      groupMap.get(provId)!.models.push({
        value: m.model_name,
        label: labels.get(m.model_name) ?? m.model_name,
        pricing: m,
      });
    }

    const groups: { provId: string; name: string; models: ModalModel[] }[] = [];
    for (const group of groupMap.values()) {
      if (q) {
        const nameMatch = group.name.toLowerCase().includes(q);
        const filtered = nameMatch
          ? group.models
          : group.models.filter(
              (m) =>
                m.label.toLowerCase().includes(q) ||
                m.value.toLowerCase().includes(q),
            );
        if (filtered.length > 0) {
          groups.push({ ...group, models: filtered });
        }
      } else if (group.models.length > 0) {
        groups.push(group);
      }
    }

    return groups;
  };

  /** Mark a model as "(recommended)" if it's the auto-assigned model for this tier */
  const isRecommended = (tierId: string, modelName: string): boolean => {
    const t = getTier(tierId);
    return t?.auto_assigned_model === modelName;
  };

  /** Check if a model is the currently active model for a tier */
  const isCurrent = (tierId: string, modelName: string): boolean => {
    const t = getTier(tierId);
    return t ? effectiveModel(t) === modelName : false;
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
          <h1>
            Routing
            <InfoTooltip>
              <For each={STAGES}>
                {(stage, i) => (
                  <>
                    <strong>{stage.label}</strong>
                    {stage.desc}
                    <Show when={i() < STAGES.length - 1}>
                      <br /><br />
                    </Show>
                  </>
                )}
              </For>
            </InfoTooltip>
          </h1>
          <span class="breadcrumb">{agentName()} &rsaquo; Assign a model to each tier</span>
        </div>
      </div>

      <Show when={!tiers.loading} fallback={
        <div class="panel" style="padding: var(--gap-xl);">
          <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
        </div>
      }>
        <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
          Models are automatically assigned based on your connected providers. You can override any tier manually. Add and manage model providers in{" "}
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
                  <div class="routing-card__tier">{stage.label}</div>

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
                            Connect a provider
                          </A>
                        </div>
                      }
                    >
                      {(modelName) => (
                        <>
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
                            <Show when={isManual()}>
                              <span class="routing-card__custom-tag">custom</span>
                            </Show>
                          </div>
                          {(() => {
                            const caps = capsLabel(modelName());
                            return caps ? <span class="routing-card__sub">{caps}</span> : null;
                          })()}
                        </>
                      )}
                    </Show>
                  </div>

                  <div class="routing-card__pricing">
                    <Show when={eff()}>
                      {(modelName) => (
                        <span class="routing-card__sub">{priceLabel(modelName())}</span>
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
                      <button class="routing-action" onClick={() => openDropdown(stage.id)}>
                        Edit
                      </button>
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
                            class={`routing-modal__model${isCurrent(tierId(), model.value) ? " routing-modal__model--current" : ""}`}
                            onClick={() => handleOverride(tierId(), model.value)}
                          >
                            <span class="routing-modal__model-label">
                              {model.label}
                              <Show when={isRecommended(tierId(), model.value)}>
                                <span class="routing-modal__recommended"> (recommended)</span>
                              </Show>
                            </span>
                            <Show when={model.pricing}>
                              {(p) => (
                                <span class="routing-modal__model-id">
                                  {pricePerM(p().input_price_per_token)} in · {pricePerM(p().output_price_per_token)} out
                                </span>
                              )}
                            </Show>
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
