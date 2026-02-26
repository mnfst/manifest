import { createSignal, For, Show, type Component } from "solid-js";
import { STAGES, PROVIDERS } from "../services/providers.js";
import { providerIcon } from "./ProviderIcon.js";
import { pricePerM, resolveProviderId } from "../services/routing-utils.js";
import type { AvailableModel, TierAssignment } from "../services/api.js";

interface Props {
  tierId: string;
  models: AvailableModel[];
  tiers: TierAssignment[];
  onSelect: (tierId: string, modelName: string) => void;
  onClose: () => void;
}

/** Resolve a display label for a model name, handling vendor-prefixed IDs. */
function labelForModel(name: string, labels: Map<string, string>): string {
  const direct = labels.get(name);
  if (direct) return direct;
  const slash = name.indexOf("/");
  if (slash !== -1) {
    const bare = name.substring(slash + 1);
    const found = labels.get(bare);
    if (found) return found;
    return bare;
  }
  return name;
}

const ModelPickerModal: Component<Props> = (props) => {
  const [search, setSearch] = createSignal("");

  const providerLabelMap = (): Map<string, string> => {
    const map = new Map<string, string>();
    for (const prov of PROVIDERS) {
      for (const m of prov.models) map.set(m.value, m.label);
    }
    return map;
  };

  const groupedModels = () => {
    const q = search().toLowerCase().trim();
    const labels = providerLabelMap();

    type ModalModel = { value: string; label: string; pricing: AvailableModel };
    const groupMap = new Map<string, { provId: string; name: string; models: ModalModel[] }>();

    for (const m of props.models) {
      const provId = resolveProviderId(m.provider);
      if (!provId) continue;
      if (!groupMap.has(provId)) {
        const provDef = PROVIDERS.find((p) => p.id === provId);
        groupMap.set(provId, { provId, name: provDef?.name ?? m.provider, models: [] });
      }
      groupMap.get(provId)!.models.push({
        value: m.model_name,
        label: labelForModel(m.model_name, labels),
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
              (m) => m.label.toLowerCase().includes(q) || m.value.toLowerCase().includes(q),
            );
        if (filtered.length > 0) groups.push({ ...group, models: filtered });
      } else if (group.models.length > 0) {
        groups.push(group);
      }
    }
    return groups;
  };

  const isRecommended = (modelName: string): boolean => {
    const t = props.tiers.find((r) => r.tier === props.tierId);
    return t?.auto_assigned_model === modelName;
  };

  return (
    <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") props.onClose(); }}>
      <div
        class="modal-card"
        style="max-width: 600px; padding: 0; display: flex; flex-direction: column; max-height: 80vh;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-picker-title"
      >
        <div class="routing-modal__header">
          <div>
            <div class="routing-modal__title" id="model-picker-title">Select a model</div>
            <div class="routing-modal__subtitle">
              {STAGES.find((s) => s.id === props.tierId)?.label} tier
            </div>
          </div>
          <button class="modal__close" onClick={() => props.onClose()} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div class="routing-modal__search-wrap">
          <svg class="routing-modal__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            class="routing-modal__search"
            type="text"
            placeholder="Search models or providers..."
            aria-label="Search models or providers"
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
                      onClick={() => props.onSelect(props.tierId, model.value)}
                    >
                      <span class="routing-modal__model-label">
                        {model.label}
                        <Show when={isRecommended(model.value)}>
                          <span class="routing-modal__recommended"> (recommended)</span>
                        </Show>
                      </span>
                      <Show when={model.pricing}>
                        {(p) => (
                          <span class="routing-modal__model-id">
                            {pricePerM(p().input_price_per_token)} in · {pricePerM(p().output_price_per_token)} out per 1M
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
  );
};

export default ModelPickerModal;
