function makeMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
  };
}

export function ensureLocalStorage(): Storage {
  const current = globalThis.localStorage as Partial<Storage> | undefined;
  const usable =
    current &&
    typeof current.clear === 'function' &&
    typeof current.getItem === 'function' &&
    typeof current.setItem === 'function';

  if (usable) return current as Storage;

  const replacement = makeMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: replacement });
  Object.defineProperty(window, 'localStorage', { configurable: true, value: replacement });
  return replacement;
}
