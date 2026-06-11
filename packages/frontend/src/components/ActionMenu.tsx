import {
  createSignal,
  createEffect,
  For,
  onCleanup,
  Show,
  type JSX,
  type Component,
} from 'solid-js';

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Optional leading icon rendered before the label. */
  icon?: JSX.Element;
}

interface ActionMenuProps {
  items: MenuItem[];
  /** Accessible label for the trigger button. Defaults to "Actions". */
  ariaLabel?: string;
  /** Extra class applied to the root wrapper (e.g. for per-surface positioning). */
  class?: string;
}

/**
 * Generic kebab ("⋮") action menu: a trigger button that toggles a dropdown of
 * caller-supplied items. Closes on outside click or Escape. Reusable across
 * cards and detail views so each surface doesn't re-implement the popover
 * wiring. An `--open` modifier is reflected on the root so surfaces can keep the
 * trigger visible while the menu is open (e.g. hover-revealed card kebabs).
 *
 * A11y: the dropdown is intentionally a plain list of buttons — it does NOT use
 * `role="menu"` / `role="menuitem"` (nor `aria-haspopup="menu"`), because those
 * roles promise full menu keyboard semantics (arrow-key roving focus, focus
 * management) that this component does not implement. Claiming them would
 * mislead assistive tech. The trigger keeps `aria-label` + `aria-expanded`,
 * which honestly describes a disclosure that toggles a group of buttons.
 */
const ActionMenu: Component<ActionMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };

  // Listen on the document only while the menu is open. Cards render one menu
  // each, so always-on listeners would scale with the grid; gating keeps it to
  // at most the open menu's pair. onCleanup inside the effect removes them when
  // the menu closes or the component unmounts.
  createEffect(() => {
    if (!open()) return;
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  return (
    <div
      ref={containerRef}
      classList={{
        'action-menu': true,
        'action-menu--open': open(),
        [props.class ?? '']: !!props.class,
      }}
    >
      <button
        type="button"
        class="action-menu__trigger"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open());
        }}
        aria-label={props.ariaLabel ?? 'Actions'}
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
                type="button"
                class="action-menu__item"
                classList={{ 'action-menu__item--danger': item.danger }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
              >
                <Show when={item.icon}>{item.icon}</Show>
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
