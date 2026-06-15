export interface TtlFifoCacheOptions {
  maxEntries: number;
  ttlMs: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlFifoCache<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(opts: TtlFifoCacheOptions) {
    this.maxEntries = opts.maxEntries;
    this.ttlMs = opts.ttlMs;
    this.now = opts.now ?? Date.now;
  }

  /**
   * `shouldCache` lets a caller skip memoizing a result it considers transient
   * (e.g. a "not found yet" sentinel). Such values are returned to the caller
   * but never stored, so the next resolve() re-runs the loader. Defaults to
   * caching every value.
   */
  async resolve(
    key: K,
    loader: (key: K) => Promise<V>,
    shouldCache: (value: V) => boolean = () => true,
  ): Promise<V> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    if (cached) this.entries.delete(key);

    const value = await loader(key);

    if (!shouldCache(value)) return value;

    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const firstKey = this.entries.keys().next().value;
      if (firstKey !== undefined) this.entries.delete(firstKey);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    return value;
  }

  invalidate(key: K): void {
    this.entries.delete(key);
  }
}
