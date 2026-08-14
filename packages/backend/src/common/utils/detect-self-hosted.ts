import { existsSync } from 'fs';

/**
 * Detects whether the app is running in the self-hosted version.
 *
 * Priority:
 * 1. Explicit `MANIFEST_MODE` env var — always wins
 *    - `selfhosted` (canonical) or legacy `local` → self-hosted
 *    - `cloud` → cloud
 * 2. Auto-detect a containerised runtime → self-hosted
 *    - Docker writes `/.dockerenv`
 *    - Podman writes `/run/.containerenv` (rootless and rootful)
 *    - Kubernetes injects `KUBERNETES_SERVICE_HOST`
 * 3. Default → cloud
 */
export function isSelfHosted(): boolean {
  const explicit = process.env['MANIFEST_MODE'];
  if (explicit === 'cloud') return false;
  if (explicit === 'selfhosted' || explicit === 'local') return true;
  if (process.env['KUBERNETES_SERVICE_HOST']) return true;
  try {
    return existsSync('/.dockerenv') || existsSync('/run/.containerenv');
  } catch {
    return false;
  }
}

/**
 * Returns the canonical hostname the container should use to reach the
 * host. Docker uses `host.docker.internal` (mapped via `host-gateway` in
 * compose). Podman exposes the same gateway as `host.containers.internal`.
 * Outside any container, `localhost` resolves correctly.
 */
export function getContainerHostAlias(): string {
  try {
    if (existsSync('/run/.containerenv') && !existsSync('/.dockerenv')) {
      return 'host.containers.internal';
    }
    if (existsSync('/.dockerenv')) return 'host.docker.internal';
  } catch {
    // fall through
  }
  return 'localhost';
}
