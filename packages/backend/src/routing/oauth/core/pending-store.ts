/**
 * In-memory TTL map for pending OAuth flows (state → flow data). Each
 * provider service holds its own instance — sharing one across providers
 * would tangle their cleanup cadences for no benefit.
 *
 * Not safe behind a load balancer. The OAuth flows that use this store
 * complete in-process within a few minutes, which is acceptable for
 * single-replica deployments and dev. Multi-replica deployments would
 * need a Redis-backed store; out of scope here.
 */
export interface PendingEntry {
  expiresAt: number;
}

export class PendingStore<T extends PendingEntry> {
  private readonly entries_ = new Map<string, T>();

  constructor(private readonly ttlMs: number) {}

  set(key: string, value: Omit<T, 'expiresAt'> & Partial<PendingEntry>): T {
    this.cleanup();
    const entry = { ...value, expiresAt: Date.now() + this.ttlMs } as T;
    this.entries_.set(key, entry);
    return entry;
  }

  get(key: string): T | undefined {
    const entry = this.entries_.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries_.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Returns the entry even if expired — caller decides how to differentiate. */
  peek(key: string): T | undefined {
    return this.entries_.get(key);
  }

  /** Get and remove in one step — the typical state-consumed-on-exchange pattern. */
  consume(key: string): T | undefined {
    const entry = this.get(key);
    if (entry) this.entries_.delete(key);
    return entry;
  }

  delete(key: string): void {
    this.entries_.delete(key);
  }

  size(): number {
    this.cleanup();
    return this.entries_.size;
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Iterate over (key, value) for fresh entries only. Useful when a caller
   * needs to find an entry by something other than its key (e.g. agentId).
   */
  *entries(): IterableIterator<[string, T]> {
    this.cleanup();
    for (const [key, value] of this.entries_) {
      yield [key, value];
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.entries_) {
      if (value.expiresAt < now) this.entries_.delete(key);
    }
  }
}
