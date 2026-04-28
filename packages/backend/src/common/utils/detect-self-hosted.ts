import { existsSync } from 'fs';

/**
 * Detects whether the app is running in the self-hosted version.
 *
 * Priority:
 * 1. Explicit `MANIFEST_MODE` env var — always wins
 *    - `selfhosted` (canonical) or legacy `local` → self-hosted
 *    - `cloud` → cloud
 * 2. Auto-detect Docker container via `/.dockerenv` → self-hosted
 * 3. Default → cloud
 */
export function isSelfHosted(): boolean {
  const explicit = process.env['MANIFEST_MODE'];
  if (explicit === 'cloud') return false;
  if (explicit === 'selfhosted' || explicit === 'local') return true;
  try {
    return existsSync('/.dockerenv');
  } catch {
    return false;
  }
}
