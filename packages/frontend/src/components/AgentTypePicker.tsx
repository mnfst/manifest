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
  return (
    <div class="agent-type-picker">
      <div class="agent-type-picker__categories" role="radiogroup" aria-label="Agent type">
        <For each={categories}>
          {(cat) => (
            <label
              class="agent-type-picker__radio"
              classList={{ 'agent-type-picker__radio--selected': props.category === cat }}
            >
              <input
                type="radio"
                name="agent-category"
                value={cat}
                checked={props.category === cat}
                onChange={() => props.onCategoryChange(cat)}
                disabled={props.disabled}
              />
              <span class="agent-type-picker__radio-label">{CATEGORY_LABELS[cat]}</span>
            </label>
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
                <Show when={PLATFORM_ICONS[plat]}>
                  <img
                    src={PLATFORM_ICONS[plat]}
                    alt=""
                    width="18"
                    height="18"
                    class="agent-type-picker__platform-icon"
                  />
                </Show>
                <span>{PLATFORM_LABELS[plat]}</span>
              </label>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default AgentTypePicker;
