import { createSignal, For, onCleanup, onMount, Show, type Component } from 'solid-js';

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionMenuProps {
  items: MenuItem[];
}

const ActionMenu: Component<ActionMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  onMount(() => document.addEventListener('click', handleClickOutside));
  onCleanup(() => document.removeEventListener('click', handleClickOutside));

  return (
    <div ref={containerRef} style="position: relative; display: inline-flex;">
      <button
        class="action-menu__trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open());
        }}
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={open()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      <Show when={open()}>
        <div class="action-menu__dropdown">
          <For each={props.items}>
            {(item) => (
              <button
                class="action-menu__item"
                classList={{ 'action-menu__item--danger': item.danger }}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ActionMenu;
