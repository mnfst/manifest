import { createSignal } from 'solid-js';

/**
 * Header breadcrumb. Pages set it on mount and clear it on cleanup so the
 * header reads the depth of the current view, e.g.
 * `Users / Maya Okonkwo / Claude Code` or `Projects / HSBC / Daily report`.
 *
 * `trail` holds the ancestors (each a link); `current` is the page itself.
 */
export interface BreadcrumbEntry {
  label: string;
  href: string;
}

export interface BreadcrumbCurrent {
  label: string;
  /** Optional icon URL (platform icon for an agent). */
  icon?: string;
}

/**
 * Router `state` carried when navigating to an agent from a user or project
 * page, so the header can show where the person came from.
 */
export interface ViaState {
  via?: BreadcrumbEntry[];
}

const [trail, setTrail] = createSignal<BreadcrumbEntry[]>([]);
const [current, setCurrent] = createSignal<BreadcrumbCurrent | null>(null);

export const breadcrumbTrail = trail;
export const breadcrumbCurrent = current;

export function setBreadcrumb(entries: BreadcrumbEntry[], page: BreadcrumbCurrent | null): void {
  setTrail(entries);
  setCurrent(page);
}

export function clearBreadcrumb(): void {
  setTrail([]);
  setCurrent(null);
}

/** Read the `via` trail off a router state value, tolerating anything else. */
export function viaFromState(state: unknown): BreadcrumbEntry[] {
  const via = (state as ViaState | null | undefined)?.via;
  return Array.isArray(via) ? via : [];
}
