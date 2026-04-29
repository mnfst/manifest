import { createEffect, onCleanup } from 'solid-js';

/**
 * Trap focus inside an element while it is open and restore focus to the
 * previously-active element on close. Designed for drawers/modals — the
 * benchmark and recorded-message surfaces all dropped focus to <body> on
 * close before this util.
 *
 * Usage:
 *   const [el, setEl] = createSignal<HTMLElement | undefined>();
 *   useFocusTrap(el, () => props.open);
 *
 * The trap activates only while `isOpen()` returns true and the element
 * has been mounted; it is a no-op otherwise.
 */
export function useFocusTrap(
  containerRef: () => HTMLElement | undefined,
  isOpen: () => boolean,
  options?: { initialFocus?: () => HTMLElement | undefined },
): void {
  createEffect(() => {
    if (!isOpen()) return;
    const container = containerRef();
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the requested element, the first focusable child, or the
    // container itself (with tabindex=-1 set transiently). This guarantees
    // keyboard users land somewhere predictable on open.
    const initial = options?.initialFocus?.() ?? firstFocusable(container) ?? container;
    if (initial === container && container.tabIndex < 0) {
      container.setAttribute('tabindex', '-1');
    }
    initial.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = listFocusable(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to the element that opened the surface, but only if
      // it's still in the DOM and wasn't superseded by another focus shift.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    });
  });
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function listFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );
}

function firstFocusable(container: HTMLElement): HTMLElement | undefined {
  return listFocusable(container)[0];
}
