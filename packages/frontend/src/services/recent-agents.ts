const recentlyCreated = new Set<string>();

export function markAgentCreated(slug: string): void {
  recentlyCreated.add(slug);
}

export function isRecentlyCreated(slug: string): boolean {
  return recentlyCreated.has(slug);
}

export function clearRecentAgent(slug: string): void {
  recentlyCreated.delete(slug);
}

/**
 * Persistent "setup pending" flag (localStorage-backed) so the setup modal
 * reliably reopens after a page refresh until the user dismisses or completes
 * it. Unlike the in-memory `recentlyCreated` Set above (which AgentGuard clears
 * and a refresh drops), this survives reloads. All accessors wrap localStorage
 * in try/catch so SSR / denied-storage environments degrade gracefully.
 */
const SETUP_PENDING_PREFIX = 'setup_pending_';

export function markSetupPending(slug: string): void {
  try {
    localStorage.setItem(SETUP_PENDING_PREFIX + slug, '1');
  } catch {
    // Storage unavailable (SSR / privacy mode) — pending state is best-effort.
  }
}

export function isSetupPending(slug: string): boolean {
  try {
    return localStorage.getItem(SETUP_PENDING_PREFIX + slug) === '1';
  } catch {
    return false;
  }
}

export function clearSetupPending(slug: string): void {
  try {
    localStorage.removeItem(SETUP_PENDING_PREFIX + slug);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
