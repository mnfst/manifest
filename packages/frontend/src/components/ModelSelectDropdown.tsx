import { createSignal, createResource, For, Show, type Component } from "solid-js";
import { getModelPrices } from "../services/api.js";
import { resolveProviderId } from "../services/routing-utils.js";
import { PROVIDERS } from "../services/providers.js";
import { providerIcon } from "./ProviderIcon.js";

interface ModelPricesData {
  models: { model_name: string; provider: string }[];
  lastSyncedAt: string | null;
}

interface ModelSelectDropdownProps {
  selectedValue: string | null;
  onSelect: (cliValue: string, displayLabel: string) => void;
}

function computeCliValue(modelName: string, provider: string): string {
  if (modelName.includes("/")) return modelName;
  return `${provider.toLowerCase()}/${modelName}`;
}

/** Resolve a display label for a model name from the PROVIDERS definitions. */
function labelForModel(name: string): string {
  for (const prov of PROVIDERS) {
    for (const m of prov.models) {
      if (m.value === name) return m.label;
    }
  }
  const slash = name.indexOf("/");
  if (slash !== -1) {
    const bare = name.substring(slash + 1);
    for (const prov of PROVIDERS) {
      for (const m of prov.models) {
        if (m.value === bare) return m.label;
      }
    }
    return bare;
  }
  return name;
}

const ModelSelectDropdown: Component<ModelSelectDropdownProps> = (props) => {
  const [data] = createResource(() => getModelPrices() as Promise<ModelPricesData>);
  const [search, setSearch] = createSignal("");
  const [open, setOpen] = createSignal(true);

  const groupedModels = () => {
    const d = data();
    if (!d?.models) return [];

    const q = search().toLowerCase().trim();

    type GroupModel = { value: string; label: string; cliValue: string };
    const groupMap = new Map<string, { provId: string; name: string; models: GroupModel[] }>();

    for (const m of d.models) {
      const provId = resolveProviderId(m.provider);
      if (!provId) continue;
      if (!groupMap.has(provId)) {
        const provDef = PROVIDERS.find((p) => p.id === provId);
        groupMap.set(provId, { provId, name: provDef?.name ?? m.provider, models: [] });
      }
      groupMap.get(provId)!.models.push({
        value: m.model_name,
        label: labelForModel(m.model_name),
        cliValue: computeCliValue(m.model_name, m.provider),
      });
    }

    const groups: { provId: string; name: string; models: GroupModel[] }[] = [];
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

  const handleSelect = (cliValue: string, label: string) => {
    props.onSelect(cliValue, label);
    setOpen(false);
    setSearch("");
  };

  const handleReopen = () => {
    setOpen(true);
    setSearch("");
  };

  return (
    <div class="routing-modal__inline-picker">
      <Show when={!open() && props.selectedValue}>
        <button
          class="routing-modal__selected-display"
          onClick={handleReopen}
          type="button"
          aria-label="Change model selection"
        >
          <span class="routing-modal__selected-label">{labelForModel(props.selectedValue!.split("/").pop()!)}</span>
          <span class="routing-modal__selected-hint">Click to change</span>
        </button>
      </Show>

      <Show when={open()}>
        <div class="routing-modal__search-wrap" style="padding: 0;">
          <svg class="routing-modal__search-icon" style="left: 14px;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            class="routing-modal__search"
            type="text"
            placeholder="Search models or providers..."
            aria-label="Search models"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            autofocus
          />
        </div>

        <Show when={data.loading}>
          <div class="routing-modal__empty">Loading models...</div>
        </Show>

        <Show when={!data.loading && data()}>
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
                        onClick={() => handleSelect(model.cliValue, model.label)}
                        type="button"
                      >
                        <span class="routing-modal__model-label">{model.label}</span>
                        <span class="routing-modal__model-id">{model.value}</span>
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
        </Show>
      </Show>
    </div>
  );
};

export default ModelSelectDropdown;
export { computeCliValue, labelForModel };
