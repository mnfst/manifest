import { createSignal, createResource, createMemo, createEffect, batch, For, Show, onCleanup, type Component } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { agentPath } from "../services/routing.js";
import { STAGES, PROVIDERS, getModelLabel } from "../services/providers.js";
import { providerIcon } from "../components/ProviderIcon.js";
import { toast } from "../services/toast-store.js";
import {
  getTierAssignments,
  getAvailableModels,
  getProviders,
  getPresets,
  bulkSaveTiers,
  type TierAssignment,
  type AvailableModel,
  type PresetId,
  type PresetRecommendations,
} from "../services/api.js";

/** Format per-million token price: $0.15 */
function pricePerM(perToken: number): string {
  const perM = Number(perToken) * 1_000_000;
  if (perM < 0.01) return "$0.00";
  if (perM < 1) return `$${perM.toFixed(2)}`;
  return `$${perM.toFixed(2)}`;
}

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

const PRESET_ICONS: Record<string, string> = {
  eco: "bx-leaf",
  balanced: "bx-law",
  quality: "bx-diamond-alt",
  fast: "bx-bolt",
  custom: "bx-slider-vertical-alt",
};

const PRESET_OPTIONS: { id: PresetId; label: string }[] = [
  { id: "eco", label: "Eco" },
  { id: "balanced", label: "Balanced" },
  { id: "quality", label: "Quality" },
  { id: "fast", label: "Fast" },
];

const Routing: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [tiers, { refetch: refetchTiers }] = createResource(getTierAssignments);
  const [models] = createResource(getAvailableModels);
  const [connectedProviders] = createResource(getProviders);
  const [presets] = createResource(getPresets);
  const [dropdownTier, setDropdownTier] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");

  /* ── Draft state (sparse: only tiers that differ from server) ── */
  const [draft, setDraft] = createSignal<Record<string, string | null>>({});
  const [saving, setSaving] = createSignal(false);
  const [showResetConfirm, setShowResetConfirm] = createSignal(false);
  const [routingEnabled, setRoutingEnabled] = createSignal(true);
  const [activePreset, setActivePreset] = createSignal<PresetId | "custom">("balanced");

  /** Snapshot of the custom draft — preserved when switching to another preset */
  const [customSnapshot, setCustomSnapshot] = createSignal<Record<string, string | null> | null>(null);

  /** The server doesn't track which preset is active — we use activePreset as source of truth.
   *  This memo only checks if server has overrides (for initial load detection). */
  const serverHasOverrides = createMemo(() => {
    const t = tiers();
    return t ? t.some((row) => row.override_model !== null) : false;
  });

  // One-time sync: set activePreset from server when tiers first load
  let initialized = false;
  /** Which preset was active at last save — used for dirty detection */
  let savedPreset: PresetId | "custom" = "balanced";

  createEffect(() => {
    const hasOverrides = serverHasOverrides();
    if (!initialized && tiers() && !tiers.loading) {
      initialized = true;
      const t = tiers()!;

      if (hasOverrides) {
        // Server has overrides — we don't know which preset, default to custom
        setActivePreset("custom");
        savedPreset = "custom";
        setCustomSnapshot({});  // empty draft = server state (overrides already in DB)
      } else {
        setActivePreset("balanced");
        savedPreset = "balanced";
      }

      // Restore custom snapshot from custom_model column if present
      const hasCustomSnapshot = t.some((row) => row.custom_model !== null);
      if (hasCustomSnapshot) {
        const snapshot: Record<string, string | null> = {};
        for (const row of t) {
          if (row.custom_model !== null) {
            snapshot[row.tier] = row.custom_model;
          }
        }
        setCustomSnapshot(snapshot);
      }
    }
  });

  /** Dirty = draft has unsaved changes OR user switched preset since last save */
  const isDirty = createMemo(() =>
    Object.keys(draft()).length > 0 || activePreset() !== savedPreset,
  );

  const getTier = (tierId: string): TierAssignment | undefined =>
    tiers()?.find((t) => t.tier === tierId);

  const serverEffectiveModel = (t: TierAssignment): string | null =>
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
    return `${pricePerM(info.input_price_per_token)}/${pricePerM(info.output_price_per_token)} /M`;
  };

  /* ── Card display: draft-aware ── */

  /** What model should this card display? Draft takes priority over server. */
  const effectiveModelForCard = (tierId: string): string | null => {
    const d = draft();
    if (tierId in d) {
      // Draft has an entry: if model is set use it, if null use auto fallback
      const draftModel = d[tierId];
      if (draftModel !== null && draftModel !== undefined) return draftModel;
      // null means "reset to auto" — use server auto_assigned_model
      const t = getTier(tierId);
      return t?.auto_assigned_model ?? null;
    }
    // No draft entry — use server state
    const t = getTier(tierId);
    return t ? serverEffectiveModel(t) : null;
  };

  /** Is this card showing a manual override (draft or server)? */
  const isManualForCard = (tierId: string): boolean => {
    // Named presets always show "auto" — only Custom shows manual overrides
    if (activePreset() !== "custom") return false;

    const d = draft();
    if (tierId in d) {
      return d[tierId] !== null;
    }
    const t = getTier(tierId);
    return t?.override_model !== null && t?.override_model !== undefined;
  };

  /* ── Slot-machine animation state ── */
  const [animatingTiers, setAnimatingTiers] = createSignal<Set<string>>(new Set());
  const prevModels: Record<string, string | null> = {};
  const animTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  /** Track model changes and trigger animations */
  const trackModelChange = (tierId: string, newModel: string | null) => {
    const prev = prevModels[tierId];
    if (prev !== undefined && prev !== newModel) {
      // Model changed — trigger animation
      clearTimeout(animTimers[tierId]);
      setAnimatingTiers((s) => { const next = new Set(s); next.add(tierId); return next; });
      animTimers[tierId] = setTimeout(() => {
        setAnimatingTiers((s) => { const next = new Set(s); next.delete(tierId); return next; });
      }, 300);
    }
    prevModels[tierId] = newModel;
  };

  onCleanup(() => {
    for (const t of Object.values(animTimers)) clearTimeout(t);
  });

  /* ── Handlers (all write to draft, NO API calls) ── */

  const handleOverride = (tierId: string, modelName: string) => {
    closeDropdown();
    const t = getTier(tierId);
    // If model matches current server override, remove from draft
    if (t?.override_model === modelName) {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[tierId];
        return next;
      });
    } else {
      const newDraft = { ...draft(), [tierId]: modelName };
      setDraft(newDraft);
      setActivePreset("custom");
      setCustomSnapshot({ ...newDraft });
    }
  };

  const handleReset = (tierId: string) => {
    const t = getTier(tierId);
    // If server already has no override, don't add to draft
    if (!t?.override_model) {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[tierId];
        return next;
      });
    } else {
      setDraft((prev) => ({ ...prev, [tierId]: null }));
    }
    // Check if all tiers would be auto after this
    const nextDraft = { ...draft(), [tierId]: null };
    const allAuto = STAGES.every((s) => {
      if (s.id in nextDraft) return nextDraft[s.id] === null;
      return !getTier(s.id)?.override_model;
    });
    if (allAuto) {
      setActivePreset("balanced");
      setCustomSnapshot(null);
    } else if (activePreset() === "custom") {
      // Keep the custom snapshot in sync
      setCustomSnapshot({ ...draft() });
    }
  };

  const handleResetAll = async () => {
    const wasCustom = activePreset() === "custom";
    const targetPreset = wasCustom ? "balanced" : activePreset();

    const resetDraft: Record<string, string | null> = {};
    for (const stage of STAGES) {
      const t = getTier(stage.id);
      if (t?.override_model) {
        resetDraft[stage.id] = null;
      }
    }

    batch(() => {
      setDraft(resetDraft);
      setActivePreset(targetPreset as PresetId);
      if (wasCustom) setCustomSnapshot(null);
    });

    // Auto-save
    const items = Object.entries(resetDraft).map(([tier, model]) => ({ tier, model }));
    if (items.length > 0) {
      setSaving(true);
      try {
        await bulkSaveTiers(items, targetPreset !== "custom" ? targetPreset as PresetId : "custom", savedPreset);
        await refetchTiers();
        batch(() => {
          setDraft({});
          setActivePreset(targetPreset as PresetId);
          savedPreset = targetPreset as PresetId | "custom";
          if (wasCustom) setCustomSnapshot(null);
        });
        toast.success("Routing reset to auto");
      } catch {
        // error toast from fetchMutate
      } finally {
        setSaving(false);
      }
    }
  };

  const handlePresetSelect = (presetId: PresetId) => {
    batch(() => {
      // Snapshot the current draft if leaving "custom" mode
      if (activePreset() === "custom") {
        setCustomSnapshot({ ...draft() });
      }

      const presetData = presets();
      const recommendations = presetData?.[presetId];

      if (presetId === "balanced" || !recommendations) {
        // Balanced = clear overrides, use auto-assigned models
        const d: Record<string, string | null> = {};
        for (const stage of STAGES) {
          const t = getTier(stage.id);
          if (t?.override_model) {
            d[stage.id] = null;
          }
        }
        setDraft(d);
      } else {
        // Eco / Quality / Fast — apply preset-recommended models as overrides
        const d: Record<string, string | null> = {};
        for (const stage of STAGES) {
          const recommended = recommendations[stage.id] ?? null;
          const t = getTier(stage.id);
          const serverEffective = t ? (t.override_model ?? t.auto_assigned_model) : null;

          if (recommended && recommended !== serverEffective) {
            d[stage.id] = recommended;
          } else if (recommended === t?.auto_assigned_model && t?.override_model) {
            d[stage.id] = null;
          }
        }
        setDraft(d);
      }

      setActivePreset(presetId);
    });
  };

  const handleCustomSelect = () => {
    batch(() => {
      const snapshot = customSnapshot();
      if (snapshot && Object.keys(snapshot).length > 0) {
        // Snapshot has draft-style overrides — apply them
        setDraft({ ...snapshot });
      } else if (snapshot) {
        // Empty snapshot = server already has overrides as override_model (custom is live)
        setDraft({});
      } else {
        // No snapshot at all — check custom_model from server tiers
        const t = tiers();
        if (t) {
          const d: Record<string, string | null> = {};
          for (const row of t) {
            if (row.custom_model !== null) {
              d[row.tier] = row.custom_model;
            }
          }
          if (Object.keys(d).length > 0) {
            setDraft(d);
            setCustomSnapshot(d);
          }
        }
      }
      setActivePreset("custom");
    });
  };

  const handleSave = async () => {
    const d = draft();
    const items = Object.entries(d).map(([tier, model]) => ({ tier, model }));
    const currentPreset = activePreset();

    setSaving(true);
    try {
      if (items.length > 0) {
        await bulkSaveTiers(
          items,
          currentPreset !== "custom" ? currentPreset : "custom",
          savedPreset,
        );
        await refetchTiers();
      }
      batch(() => {
        setDraft({});
        // Keep the preset the user chose — don't recalculate from server overrides
        setActivePreset(currentPreset);
        savedPreset = currentPreset;

        // Restore custom snapshot from server custom_model values
        const t = tiers();
        if (t) {
          const hasCustom = t.some((row) => row.custom_model !== null);
          if (hasCustom) {
            const snap: Record<string, string | null> = {};
            for (const row of t) {
              if (row.custom_model !== null) snap[row.tier] = row.custom_model;
            }
            setCustomSnapshot(snap);
          } else if (currentPreset === "custom") {
            // Just saved custom — server overrides ARE the custom state
            setCustomSnapshot({});
          } else {
            setCustomSnapshot(null);
          }
        }
      });
      toast.success("Routing saved");
    } catch {
      // error toast from fetchMutate
    } finally {
      setSaving(false);
    }
  };

  const hasOverrides = () => {
    // Server overrides OR draft overrides
    const serverOverrides = tiers()?.some((t) => t.override_model !== null) ?? false;
    if (serverOverrides) return true;
    // Check if draft has any non-null entries
    return Object.values(draft()).some((v) => v !== null);
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

  return (
    <div class="container--md">
      <Title>{agentName()} - Routing | Manifest</Title>
      <Meta name="description" content={`Configure model routing for ${agentName()}.`} />

      <div class="page-header">
        <div>
          <div class="routing-title-row">
            <h1>Routing</h1>
            <span class={`routing-status-indicator${routingEnabled() ? " routing-status-indicator--active" : ""}`}>
              <span class="routing-status-indicator__dot" />
              {routingEnabled() ? "Active" : "Inactive"}
            </span>
          </div>
          <span class="breadcrumb">{agentName()} &rsaquo; Assign a model to each tier</span>
        </div>
        <button
          class={`routing-status-btn${routingEnabled() ? " routing-status-btn--outline" : ""}`}
          onClick={() => setRoutingEnabled(!routingEnabled())}
        >
          {routingEnabled() ? "Deactivate" : "Activate"}
        </button>
      </div>

      <Show when={routingEnabled()}>
      <div class="routing-content-enter">
      <Show when={!tiers.loading} fallback={
        <div class="panel" style="padding: var(--gap-xl);">
          <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
        </div>
      }>
        {/* ── Preset selector ── */}
        <div class="preset-section">
          <h3 class="preset-section__title">Presets</h3>
          <p class="preset-section__desc">
            Choose a routing preset for your agent, or customize models per tier.
          </p>
          <div class="preset-selector">
            <For each={PRESET_OPTIONS}>
              {(opt) => (
                <button
                  class={`preset-selector__btn${activePreset() === opt.id ? " preset-selector__btn--active" : ""}`}
                  onClick={() => handlePresetSelect(opt.id)}
                >
                  <i class={`bxd ${PRESET_ICONS[opt.id]} preset-selector__icon`} />
                  {opt.label}
                </button>
              )}
            </For>
            <Show when={activePreset() === "custom" || customSnapshot() !== null}>
              <button
                class={`preset-selector__btn${activePreset() === "custom" ? " preset-selector__btn--active" : ""}`}
                onClick={handleCustomSelect}
              >
                <i class={`bxd ${PRESET_ICONS.custom} preset-selector__icon`} />
                Custom
              </button>
            </Show>
          </div>
        </div>

        <div class="routing-cards">
          <For each={STAGES}>
            {(stage) => {
              const eff = () => {
                const model = effectiveModelForCard(stage.id);
                trackModelChange(stage.id, model);
                return model;
              };
              const manual = () => isManualForCard(stage.id);
              const isAnimating = () => animatingTiers().has(stage.id);

              return (
                <div class="routing-card">
                  <div class="routing-card__header">
                    <span class="routing-card__tier">{stage.label}</span>
                    <span class="routing-card__desc">{stage.desc}</span>
                  </div>

                  <div class={`routing-card__body${isAnimating() ? " routing-card__body--slot" : ""}`}>
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
                        <div class="routing-card__model-content">
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
                            <Show when={!manual()}>
                              <span class="routing-card__auto-tag">auto</span>
                            </Show>
                          </div>
                          <span class="routing-card__sub">{priceLabel(modelName())}</span>
                        </div>
                      )}
                    </Show>
                  </div>

                  <div class="routing-card__actions">
                    <Show
                      when={manual()}
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

        <div class="routing-actions">
          <div class="routing-actions__buttons">
            <Show when={hasOverrides()}>
              <button class="btn btn--outline" style="font-size: var(--font-size-sm);" onClick={() => setShowResetConfirm(true)}>
                Reset all to auto
              </button>
            </Show>
            <button
              class="btn btn--primary"
              style="font-size: var(--font-size-sm);"
              disabled={!isDirty() || saving()}
              onClick={handleSave}
            >
              {saving() ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Show>
      </div>
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
                                  {pricePerM(p().input_price_per_token)}/{pricePerM(p().output_price_per_token)} /M
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

      {/* ── Reset confirmation modal ─────────────────── */}
      <Show when={showResetConfirm()}>
        <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}>
          <div class="modal-card" style="max-width: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-md);">
              <h3 style="margin: 0; font-size: var(--font-size-lg);">Reset all to auto</h3>
              <button
                style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
                onClick={() => setShowResetConfirm(false)}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-lg); line-height: 1.5;">
              <Show when={activePreset() === "custom"} fallback={<>This will clear all model overrides and revert every tier to auto-assigned models.</>}>
                This will delete your <strong style="color: hsl(var(--foreground));">Custom</strong> preset and switch to <strong style="color: hsl(var(--foreground));">Balanced</strong>.
              </Show>
            </p>
            <div style="display: flex; gap: var(--gap-sm); justify-content: flex-end;">
              <button
                class="btn btn--outline"
                style="font-size: var(--font-size-sm);"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                class="btn btn--primary"
                style="font-size: var(--font-size-sm);"
                onClick={() => { handleResetAll(); setShowResetConfirm(false); }}
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Routing;
