import { existsSync } from 'fs';

/**
 * Detects whether the app is running in local/self-hosted mode.
 *
 * Priority:
 * 1. Explicit `MANIFEST_MODE` env var (`local` or `cloud`) — always wins
 * 2. Auto-detect Docker container via `/.dockerenv` → local mode
 * 3. Default → cloud mode
 */
export function isLocalMode(): boolean {
  const explicit = process.env['MANIFEST_MODE'];
  if (explicit === 'cloud') return false;
  if (explicit === 'local') return true;
  try {
    return existsSync('/.dockerenv');
  } catch {
    return false;
  }
}
