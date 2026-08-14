import { PendingStore } from './pending-store';

interface FakeEntry {
  expiresAt: number;
  payload: string;
}

describe('PendingStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores entries and stamps an expiresAt based on the configured TTL', () => {
    const store = new PendingStore<FakeEntry>(10_000);
    const entry = store.set('key', { payload: 'hello' });
    expect(entry.payload).toBe('hello');
    expect(entry.expiresAt).toBe(Date.now() + 10_000);
    expect(store.size()).toBe(1);
  });

  it('get returns the entry while fresh and undefined once expired', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('k', { payload: 'x' });
    expect(store.get('k')?.payload).toBe('x');
    jest.advanceTimersByTime(1_001);
    expect(store.get('k')).toBeUndefined();
    expect(store.isEmpty()).toBe(true);
  });

  it('peek returns expired entries (so callers can produce a specific error)', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('k', { payload: 'x' });
    jest.advanceTimersByTime(2_000);
    expect(store.peek('k')?.payload).toBe('x');
  });

  it('consume returns the entry and removes it (one-time-use)', () => {
    const store = new PendingStore<FakeEntry>(10_000);
    store.set('k', { payload: 'x' });
    expect(store.consume('k')?.payload).toBe('x');
    expect(store.consume('k')).toBeUndefined();
  });

  it('delete removes an entry by key', () => {
    const store = new PendingStore<FakeEntry>(10_000);
    store.set('k', { payload: 'x' });
    store.delete('k');
    expect(store.size()).toBe(0);
  });

  it('cleans up expired entries opportunistically on size/set calls', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('a', { payload: '1' });
    store.set('b', { payload: '2' });
    expect(store.size()).toBe(2);
    jest.advanceTimersByTime(1_500);
    // size() triggers cleanup
    expect(store.size()).toBe(0);
  });

  it('returns undefined from peek for unknown keys', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    expect(store.peek('nope')).toBeUndefined();
  });

  it('iterates over fresh entries via entries()', () => {
    const store = new PendingStore<FakeEntry>(10_000);
    store.set('a', { payload: '1' });
    store.set('b', { payload: '2' });
    const seen = [...store.entries()].map(([k, v]) => `${k}:${v.payload}`).sort();
    expect(seen).toEqual(['a:1', 'b:2']);
  });

  it('skips expired entries when iterating', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('a', { payload: '1' });
    jest.advanceTimersByTime(1_500);
    expect([...store.entries()]).toEqual([]);
  });

  // Regression: ensure cleanup actually drains the internal map rather than
  // just hiding entries from iteration. `peek()` is the only public read that
  // does NOT trigger cleanup, so peek-after-iterate proves the map was
  // mutated, not just filtered on the way out.
  it('entries() skips expired entries AND cleanup removes them from internal map', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('a', { payload: '1' });
    store.set('b', { payload: '2' });
    jest.advanceTimersByTime(1_500);
    // Trigger cleanup via entries() iteration.
    const seen = [...store.entries()];
    expect(seen).toEqual([]);
    // peek() does not clean up, so if either key is still findable the
    // internal map was never drained.
    expect(store.peek('a')).toBeUndefined();
    expect(store.peek('b')).toBeUndefined();
  });

  // 10 entries expire at the same instant — confirms the cleanup loop drains
  // every match in one pass rather than just the first one (a common
  // map-iteration bug when deleting in place).
  it('cleanup drains all expired entries in a single pass (rapid expirations)', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    for (let i = 0; i < 10; i++) {
      store.set(`k${i}`, { payload: `p${i}` });
    }
    expect(store.size()).toBe(10);
    jest.advanceTimersByTime(1_001);
    // size() triggers cleanup — all 10 should be gone.
    expect(store.size()).toBe(0);
    // Direct peek confirms each key was removed from the map.
    for (let i = 0; i < 10; i++) {
      expect(store.peek(`k${i}`)).toBeUndefined();
    }
  });

  // Staggered TTLs: only the expired half should be drained. Guards against
  // a regression where cleanup accidentally deletes fresh entries.
  it('cleanup preserves fresh entries while removing expired ones', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('old1', { payload: 'old1' });
    store.set('old2', { payload: 'old2' });
    // Advance halfway through the TTL, then add fresh entries.
    jest.advanceTimersByTime(700);
    store.set('fresh1', { payload: 'fresh1' });
    store.set('fresh2', { payload: 'fresh2' });
    // Advance past the original TTL — old1/old2 expire, fresh1/fresh2 don't.
    jest.advanceTimersByTime(400);
    expect(store.size()).toBe(2);
    expect(store.peek('old1')).toBeUndefined();
    expect(store.peek('old2')).toBeUndefined();
    expect(store.get('fresh1')?.payload).toBe('fresh1');
    expect(store.get('fresh2')?.payload).toBe('fresh2');
  });

  // entries() runs cleanup BEFORE yielding, then iterates the underlying Map
  // directly. Mutating that Map mid-iteration must not crash — per the JS
  // spec, deleted-before-visit keys are skipped and added-during-iteration
  // keys are visited.
  it('entries() iteration is safe even when the store mutates mid-loop', () => {
    const store = new PendingStore<FakeEntry>(10_000);
    store.set('a', { payload: '1' });
    store.set('b', { payload: '2' });
    store.set('c', { payload: '3' });
    const collected: string[] = [];
    for (const [key] of store.entries()) {
      collected.push(key);
      // Delete an unvisited key — it should be skipped, not crash.
      if (key === 'a') store.delete('b');
      // Add a fresh key — it should be visited after 'c'.
      if (key === 'c') store.set('d', { payload: '4' });
    }
    expect(collected).toEqual(['a', 'c', 'd']);
    expect(store.peek('d')?.payload).toBe('4');
  });

  // Repeated set() of the same key must replace (not duplicate) the entry,
  // and the latest expiresAt should win. Important because the pending-OAuth
  // flow could conceivably re-issue the same state under odd retry conditions.
  it('set() with the same key replaces the entry with a fresh TTL', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    const first = store.set('k', { payload: 'v1' });
    jest.advanceTimersByTime(500);
    const second = store.set('k', { payload: 'v2' });
    expect(second.payload).toBe('v2');
    expect(second.expiresAt).toBe(first.expiresAt + 500);
    expect(store.size()).toBe(1);
    expect(store.get('k')?.payload).toBe('v2');
  });

  // consume() on an expired entry behaves like a miss (no return value) and
  // still removes the entry — verifies the consume/get composition does not
  // leave stale entries in the map after time passes.
  it('consume() returns undefined and removes an expired entry', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('k', { payload: 'x' });
    jest.advanceTimersByTime(1_500);
    expect(store.consume('k')).toBeUndefined();
    expect(store.peek('k')).toBeUndefined();
  });

  // isEmpty() must trigger cleanup so a store full of expired entries reports
  // empty rather than non-empty. Without this, `shutdownCallbackServerIfIdle`
  // in redirect-pkce-oauth.base.ts would never shut the server down.
  it('isEmpty() reports true after every entry expires', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('a', { payload: '1' });
    store.set('b', { payload: '2' });
    expect(store.isEmpty()).toBe(false);
    jest.advanceTimersByTime(1_500);
    expect(store.isEmpty()).toBe(true);
  });

  // delete() on an unknown key should not throw (Map.delete returns false,
  // but the public API hides that — verify the contract is "best-effort no-op").
  it('delete() on an unknown key is a no-op', () => {
    const store = new PendingStore<FakeEntry>(10_000);
    store.set('a', { payload: '1' });
    expect(() => store.delete('does-not-exist')).not.toThrow();
    expect(store.size()).toBe(1);
  });

  // TTL boundary: an entry exactly at expiresAt is treated as still fresh
  // because the check is `expiresAt < now` (strict less-than). Pin this so a
  // refactor to <= doesn't silently invalidate tokens one ms early.
  it('treats an entry exactly at its expiresAt boundary as still fresh', () => {
    const store = new PendingStore<FakeEntry>(1_000);
    store.set('k', { payload: 'x' });
    // Advance to exactly the expiresAt timestamp.
    jest.advanceTimersByTime(1_000);
    expect(store.get('k')?.payload).toBe('x');
    // One more tick should push it over the edge.
    jest.advanceTimersByTime(1);
    expect(store.get('k')).toBeUndefined();
  });
});
