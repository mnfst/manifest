/**
 * Vitest setup: provide a fully-featured localStorage/sessionStorage polyfill.
 *
 * Node.js 25 exposes a built-in localStorage global (node:internal/webstorage)
 * that lacks .clear() when --localstorage-file is not set. Vitest's jsdom
 * environment inherits this broken global instead of jsdom's own Storage.
 * We replace both globals with a minimal but complete in-memory implementation.
 */

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index: number) => {
      const keys = Array.from(map.keys());
      return keys[index] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

const ls = createStorage();
const ss = createStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: ls,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: ss,
  writable: true,
  configurable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(window, 'sessionStorage', {
    value: ss,
    writable: true,
    configurable: true,
  });
}
