/**
 * Scroll handler for `.scroll-panel__body`: hides the parent panel's bottom
 * fade (`.scroll-panel--at-bottom`) once the user has scrolled to the end.
 */
export function toggleScrollFade(e: { currentTarget: HTMLElement }): void {
  const el = e.currentTarget;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
}
