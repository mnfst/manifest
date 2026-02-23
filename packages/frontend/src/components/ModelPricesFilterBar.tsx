import { For, Show, type Component } from "solid-js";

interface ModelPricesFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  providers: string[];
  selectedProviders: Set<string>;
  onToggleProvider: (provider: string) => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

const ModelPricesFilterBar: Component<ModelPricesFilterBarProps> = (props) => {
  const hasActiveFilters = () => props.search.trim() !== "" || props.selectedProviders.size > 0;

  return (
    <div class="model-filter">
      <div class="model-filter__row">
        <div class="model-filter__search-wrapper">
          <svg
            class="model-filter__search-icon"
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
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            class="model-filter__search"
            placeholder="Search models..."
            value={props.search}
            onInput={(e) => props.onSearchChange(e.currentTarget.value)}
            aria-label="Search models by name"
          />
          <Show when={props.search.length > 0}>
            <button
              class="model-filter__clear-input"
              onClick={() => props.onSearchChange("")}
              aria-label="Clear search"
              type="button"
            >
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </Show>
        </div>
        <div class="model-filter__summary">
          <Show when={hasActiveFilters()} fallback={
            <span>{props.totalCount} models</span>
          }>
            <span>{props.filteredCount} of {props.totalCount} models</span>
            <button
              class="model-filter__clear-all"
              onClick={props.onClearFilters}
              type="button"
            >
              Clear filters
            </button>
          </Show>
        </div>
      </div>
      <Show when={props.providers.length > 1}>
        <div class="model-filter__chips" role="group" aria-label="Filter by provider">
          <For each={props.providers}>
            {(provider) => (
              <button
                class="model-filter__chip"
                classList={{ "model-filter__chip--active": props.selectedProviders.has(provider) }}
                onClick={() => props.onToggleProvider(provider)}
                type="button"
                aria-pressed={props.selectedProviders.has(provider)}
              >
                {provider}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ModelPricesFilterBar;
