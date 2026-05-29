import { createSignal, For, Show, type Component } from 'solid-js';
import {
  SIDEBAR_BLOCKS,
  SIDEBAR_BLOCK_IDS,
  SIDEBAR_ITEM_LABELS,
  type SidebarBlockId,
  type SidebarItemId,
} from '../services/sidebar-nav.js';
import {
  allSidebarBlocksVisible,
  isSidebarBlockVisible,
  isSidebarItemPrefEnabled,
  resetSidebarVisibility,
  setSidebarBlockVisible,
  setSidebarItemVisible,
} from '../services/sidebar-preferences.js';

interface VisibilitySwitchProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

const VisibilitySwitch: Component<VisibilitySwitchProps> = (props) => (
  <button
    type="button"
    class="routing-switch routing-switch--compact"
    classList={{ 'routing-switch--on': props.checked }}
    aria-pressed={props.checked}
    aria-label={`${props.checked ? 'Hide' : 'Show'} ${props.label}`}
    onClick={() => props.onChange(!props.checked)}
  >
    <span class="routing-switch__track">
      <span class="routing-switch__thumb" />
    </span>
  </button>
);

interface ItemVisibilityEyeProps {
  label: string;
  visible: boolean;
  onChange: (next: boolean) => void;
}

const ItemVisibilityEye: Component<ItemVisibilityEyeProps> = (props) => (
  <button
    type="button"
    class="btn btn--ghost btn--sm"
    aria-pressed={props.visible}
    aria-label={`${props.visible ? 'Hide' : 'Show'} ${props.label}`}
    title={props.visible ? `Hide ${props.label}` : `Show ${props.label}`}
    onClick={() => props.onChange(!props.visible)}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <Show
        when={props.visible}
        fallback={
          <>
            <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
            <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
            <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
            <path d="m2 2 20 20" />
          </>
        }
      >
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </Show>
    </svg>
  </button>
);

const ChevronIcon: Component<{ open: boolean }> = (props) => (
  <svg
    class="sidebar-prefs__chevron"
    classList={{ 'sidebar-prefs__chevron--open': props.open }}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SidebarPreferencesSection: Component = () => {
  const [expandedBlocks, setExpandedBlocks] = createSignal<
    Partial<Record<SidebarBlockId, boolean>>
  >({});

  const blockChecked = (blockId: SidebarBlockId) => isSidebarBlockVisible(blockId);
  const itemChecked = (itemId: SidebarItemId) => isSidebarItemPrefEnabled(itemId);
  const hasChildItems = (blockId: SidebarBlockId) => blockId !== 'feedback';

  const isBlockExpanded = (blockId: SidebarBlockId) => {
    if (!blockChecked(blockId) || !hasChildItems(blockId)) return false;
    return expandedBlocks()[blockId] !== false;
  };

  const toggleBlockExpanded = (blockId: SidebarBlockId) => {
    if (!blockChecked(blockId)) return;
    setExpandedBlocks((prev) => ({
      ...prev,
      [blockId]: expandedBlocks()[blockId] === false,
    }));
  };

  const setBlockVisible = (blockId: SidebarBlockId, visible: boolean) => {
    setSidebarBlockVisible(blockId, visible);
    if (visible && hasChildItems(blockId)) {
      setExpandedBlocks((prev) => ({ ...prev, [blockId]: true }));
    }
  };

  return (
    <>
      <h2 class="settings-section__title">Sidebar navigation</h2>
      <div class="settings-card">
        <div class="settings-card__body">
          <p class="settings-card__desc">
            Choose which links appear in the agent sidebar. Preferences are saved in this browser
            and apply to all agents.
          </p>
          <div class="sidebar-prefs__groups">
            <For each={SIDEBAR_BLOCK_IDS}>
              {(blockId) => (
                <div class="setup-method sidebar-prefs__group">
                  <div class="sidebar-prefs__header">
                    <div class="sidebar-prefs__header-start">
                      <span class="setup-step__heading sidebar-prefs__title">
                        {SIDEBAR_BLOCKS[blockId].title}
                      </span>
                      <Show when={hasChildItems(blockId)}>
                        <button
                          type="button"
                          class="sidebar-prefs__chevron-btn"
                          disabled={!blockChecked(blockId)}
                          aria-expanded={isBlockExpanded(blockId)}
                          aria-controls={`sidebar-prefs-${blockId}`}
                          aria-label={
                            isBlockExpanded(blockId)
                              ? `Collapse ${SIDEBAR_BLOCKS[blockId].title}`
                              : `Expand ${SIDEBAR_BLOCKS[blockId].title}`
                          }
                          onClick={() => toggleBlockExpanded(blockId)}
                        >
                          <ChevronIcon open={isBlockExpanded(blockId)} />
                        </button>
                      </Show>
                    </div>
                    <VisibilitySwitch
                      label={SIDEBAR_BLOCKS[blockId].title}
                      checked={blockChecked(blockId)}
                      onChange={(next) => setBlockVisible(blockId, next)}
                    />
                  </div>
                  <Show when={blockChecked(blockId) && isBlockExpanded(blockId)}>
                    <div
                      class="setup-method__body sidebar-prefs__items"
                      id={`sidebar-prefs-${blockId}`}
                    >
                      <For each={[...SIDEBAR_BLOCKS[blockId].items]}>
                        {(itemId) => (
                          <div class="sidebar-prefs__item">
                            <span
                              class="sidebar-prefs__item-label"
                              classList={{
                                'sidebar-prefs__item-label--enabled': itemChecked(itemId),
                              }}
                            >
                              {SIDEBAR_ITEM_LABELS[itemId]}
                            </span>
                            <ItemVisibilityEye
                              label={SIDEBAR_ITEM_LABELS[itemId]}
                              visible={itemChecked(itemId)}
                              onChange={(next) => setSidebarItemVisible(itemId, next)}
                            />
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
        <div class="settings-card__footer">
          <button
            type="button"
            class="btn btn--outline btn--sm"
            disabled={allSidebarBlocksVisible()}
            onClick={() => resetSidebarVisibility()}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
};

export default SidebarPreferencesSection;
