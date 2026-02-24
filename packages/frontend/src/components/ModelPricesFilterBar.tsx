import { createSignal, createMemo, For, Show, onCleanup, type Component } from "solid-js";

interface ModelPricesFilterBarProps {
  allModels: string[];
  allProviders: string[];
  selectedModels: Set<string>;
  selectedProviders: Set<string>;
  onAddModel: (model: string) => void;
  onRemoveModel: (model: string) => void;
  onAddProvider: (provider: string) => void;
  onRemoveProvider: (provider: string) => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

interface Suggestion {
  type: "Provider" | "Model";
  value: string;
}

interface Tag {
  type: "Provider" | "Model";
  value: string;
}

/** Maps provider display names to icon filenames in /icons/providers/ */
const providerIconMap: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  DeepSeek: "deepseek",
  Mistral: "mistral",
  Meta: "meta",
  Amazon: "amazon",
  Alibaba: "alibaba",
  Moonshot: "moonshot",
  Zhipu: "zhipu",
  Cohere: "cohere",
  xAI: "xai",
};

/** Providers whose icons are monochrome (dark fill) and need inversion in dark mode */
const monoProviders = new Set(["OpenAI", "Anthropic", "Moonshot", "xAI"]);

const getProviderIconSrc = (provider: string): string | null => {
  const key = providerIconMap[provider];
  return key ? `/icons/providers/${key}.svg` : null;
};

const ProviderIcon: Component<{ provider: string; size?: number }> = (props) => {
  const src = () => getProviderIconSrc(props.provider);
  const size = () => props.size ?? 16;
  const isMono = () => monoProviders.has(props.provider);

  return (
    <Show when={src()} fallback={
      <svg class="model-filter__provider-icon" width={size()} height={size()} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    }>
      <img
        class="model-filter__provider-icon"
        classList={{ "model-filter__provider-icon--mono": isMono() }}
        src={src()!}
        alt=""
        width={size()}
        height={size()}
        aria-hidden="true"
      />
    </Show>
  );
};

const ModelPricesFilterBar: Component<ModelPricesFilterBarProps> = (props) => {
  const [query, setQuery] = createSignal("");
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [highlightIndex, setHighlightIndex] = createSignal(-1);
  let comboboxRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const hasActiveFilters = () => props.selectedModels.size > 0 || props.selectedProviders.size > 0;

  const activeTags = createMemo<Tag[]>(() => {
    const tags: Tag[] = [];
    for (const p of props.selectedProviders) {
      tags.push({ type: "Provider", value: p });
    }
    for (const m of props.selectedModels) {
      tags.push({ type: "Model", value: m });
    }
    return tags;
  });

  const matchingProviders = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (q.length < 2) return [];
    return props.allProviders
      .filter((p) => !props.selectedProviders.has(p) && p.toLowerCase().includes(q))
      .slice(0, 5);
  });

  const matchingModels = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (q.length < 2) return [];
    return props.allModels
      .filter((m) => !props.selectedModels.has(m) && m.toLowerCase().includes(q))
      .slice(0, 5);
  });

  const flatSuggestions = createMemo<Suggestion[]>(() => {
    const suggestions: Suggestion[] = [];
    for (const p of matchingProviders()) {
      suggestions.push({ type: "Provider", value: p });
    }
    for (const m of matchingModels()) {
      suggestions.push({ type: "Model", value: m });
    }
    return suggestions;
  });

  const selectSuggestion = (suggestion: Suggestion) => {
    if (suggestion.type === "Provider") {
      props.onAddProvider(suggestion.value);
    } else {
      props.onAddModel(suggestion.value);
    }
    setQuery("");
    setDropdownOpen(false);
    setHighlightIndex(-1);
    inputRef?.focus();
  };

  const removeTag = (tag: Tag) => {
    if (tag.type === "Provider") {
      props.onRemoveProvider(tag.value);
    } else {
      props.onRemoveModel(tag.value);
    }
  };

  const handleInput = (e: InputEvent) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setQuery(value);
    setHighlightIndex(-1);
    setDropdownOpen(value.trim().length >= 2);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const suggestions = flatSuggestions();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!dropdownOpen() && query().trim().length >= 2) {
        setDropdownOpen(true);
      }
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = highlightIndex();
      if (idx >= 0 && idx < suggestions.length) {
        selectSuggestion(suggestions[idx]!);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightIndex(-1);
    } else if (e.key === "Backspace" && query() === "") {
      const tags = activeTags();
      if (tags.length > 0) {
        removeTag(tags[tags.length - 1]!);
      }
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (comboboxRef && !comboboxRef.contains(e.target as Node)) {
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
    });
  }

  return (
    <div class="model-filter">
      <div class="model-filter__row">
        <div class="model-filter__combobox" ref={comboboxRef}>
          <div class="model-filter__input-wrapper">
            <svg
              class="model-filter__search-icon"
              width="15"
              height="15"
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
              ref={inputRef}
              type="text"
              class="model-filter__search"
              placeholder="Search models or providers..."
              value={query()}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={dropdownOpen()}
              aria-autocomplete="list"
              aria-label="Search models or providers"
            />
          </div>
          <Show when={dropdownOpen() && flatSuggestions().length > 0}>
            <div class="model-filter__dropdown" role="listbox">
              <Show when={matchingProviders().length > 0}>
                <div class="model-filter__dropdown-group">
                  <div class="model-filter__dropdown-label">Providers</div>
                  <For each={matchingProviders()}>
                    {(provider) => {
                      const idx = () => flatSuggestions().findIndex((s) => s.type === "Provider" && s.value === provider);
                      return (
                        <button
                          class="model-filter__dropdown-item"
                          classList={{ "model-filter__dropdown-item--highlighted": highlightIndex() === idx() }}
                          onClick={() => selectSuggestion({ type: "Provider", value: provider })}
                          onMouseEnter={() => setHighlightIndex(idx())}
                          type="button"
                          role="option"
                          aria-selected={highlightIndex() === idx()}
                        >
                          <span class="model-filter__dropdown-item-name">
                            <ProviderIcon provider={provider} size={16} />
                            {provider}
                          </span>
                          <span class="model-filter__dropdown-item-type">Provider</span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
              <Show when={matchingModels().length > 0}>
                <div class="model-filter__dropdown-group">
                  <div class="model-filter__dropdown-label">Models</div>
                  <For each={matchingModels()}>
                    {(model) => {
                      const idx = () => flatSuggestions().findIndex((s) => s.type === "Model" && s.value === model);
                      return (
                        <button
                          class="model-filter__dropdown-item"
                          classList={{ "model-filter__dropdown-item--highlighted": highlightIndex() === idx() }}
                          onClick={() => selectSuggestion({ type: "Model", value: model })}
                          onMouseEnter={() => setHighlightIndex(idx())}
                          type="button"
                          role="option"
                          aria-selected={highlightIndex() === idx()}
                        >
                          <span class="model-filter__dropdown-item-name">{model}</span>
                          <span class="model-filter__dropdown-item-type">Model</span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </div>
        <div class="model-filter__summary">
          <Show when={hasActiveFilters()} fallback={
            <span>{props.totalCount} models</span>
          }>
            <span>{props.filteredCount} of {props.totalCount} models</span>
            <button
              class="model-filter__clear-all"
              onClick={() => { props.onClearFilters(); setQuery(""); setDropdownOpen(false); }}
              type="button"
            >
              Clear filters
            </button>
          </Show>
        </div>
      </div>
      <Show when={activeTags().length > 0}>
        <div class="model-filter__tags">
          <For each={activeTags()}>
            {(tag) => (
              <span class="model-filter__tag" classList={{ "model-filter__tag--provider": tag.type === "Provider" }}>
                <Show when={tag.type === "Provider"}>
                  <ProviderIcon provider={tag.value} size={16} />
                </Show>
                <Show when={tag.type === "Model"}>
                  <span class="model-filter__tag-type">Model:</span>
                </Show>
                <span class="model-filter__tag-value">{tag.value}</span>
                <button
                  class="model-filter__tag-remove"
                  onClick={() => removeTag(tag)}
                  type="button"
                  aria-label={`Remove ${tag.type} ${tag.value}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ModelPricesFilterBar;
