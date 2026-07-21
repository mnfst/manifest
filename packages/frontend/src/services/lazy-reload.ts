import { lazy, type Component } from 'solid-js';

const RELOAD_KEY_PREFIX = 'manifest:chunk-reload:';

function reloadKey(scope: string): string {
  return `${RELOAD_KEY_PREFIX}${scope}`;
}

/**
 * Wrap a dynamic import with retry-via-reload. On import failure,
 * sets a sessionStorage flag and reloads the page. The flag prevents
 * infinite reload loops — if the reload itself fails, the error
 * propagates normally.
 */
export function lazyReload<T extends Component>(
  factory: () => Promise<{ default: T }>,
  scope: string,
): ReturnType<typeof lazy<T>> {
  return lazy(() => loadWithChunkReload(factory, scope));
}

/**
 * Retry a failed dynamic chunk once via a full page reload. The marker is
 * cleared only after a chunk succeeds, so a persistently missing chunk cannot
 * enter a reload loop.
 */
export async function loadWithChunkReload<T>(factory: () => Promise<T>, scope: string): Promise<T> {
  const key = reloadKey(scope);
  try {
    const loaded = await factory();
    clearReloadFlag(scope);
    return loaded;
  } catch (error) {
    const alreadyReloaded = sessionStorage.getItem(key);
    if (!alreadyReloaded) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
      return new Promise<T>(() => {});
    }
    clearReloadFlag(scope);
    throw error;
  }
}

export function clearReloadFlag(scope: string): void {
  sessionStorage.removeItem(reloadKey(scope));
}
