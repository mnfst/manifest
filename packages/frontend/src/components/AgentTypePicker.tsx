import { For, Show, type Component } from 'solid-js';
import {
  type AgentCategory,
  type AgentPlatform,
  CATEGORY_LABELS,
  PLATFORM_LABELS,
  PLATFORMS_BY_CATEGORY,
  PLATFORM_ICONS,
} from 'manifest-shared';

interface Props {
  category: AgentCategory | null;
  platform: AgentPlatform | null;
  onCategoryChange: (c: AgentCategory) => void;
  onPlatformChange: (p: AgentPlatform) => void;
  disabled?: boolean;
}

const categories: AgentCategory[] = ['personal', 'app'];

const AgentTypePicker: Component<Props> = (props) => {
  const iconFor = (plat: AgentPlatform) => {
    if (plat === 'other')
      return props.category === 'personal' ? '/icons/other-agent.svg' : '/icons/other.svg';
    return PLATFORM_ICONS[plat];
  };

  return (
    <div class="agent-type-picker">
      <div class="panel__tabs agent-type-picker__tabs" role="tablist" aria-label="Agent type">
        <For each={categories}>
          {(cat) => (
            <button
              role="tab"
              class="panel__tab"
              classList={{ 'panel__tab--active': props.category === cat }}
              aria-selected={props.category === cat}
              onClick={() => props.onCategoryChange(cat)}
              disabled={props.disabled}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          )}
        </For>
      </div>

      <Show when={props.category}>
        <div class="agent-type-picker__platforms" role="radiogroup" aria-label="Platform">
          <For each={[...PLATFORMS_BY_CATEGORY[props.category!]]}>
            {(plat) => (
              <label
                class="agent-type-picker__platform"
                classList={{ 'agent-type-picker__platform--selected': props.platform === plat }}
              >
                <input
                  type="radio"
                  name="agent-platform"
                  value={plat}
                  checked={props.platform === plat}
                  onChange={() => props.onPlatformChange(plat)}
                  disabled={props.disabled}
                />
                <Show when={iconFor(plat)}>
                  <img
                    src={iconFor(plat)}
                    alt=""
                    width="18"
                    height="18"
                    class="agent-type-picker__platform-icon"
                  />
                </Show>
                <span>{PLATFORM_LABELS[plat]}</span>
                <svg
                  class="agent-type-picker__check"
                  classList={{ 'agent-type-picker__check--visible': props.platform === plat }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
                </svg>
              </label>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default AgentTypePicker;
