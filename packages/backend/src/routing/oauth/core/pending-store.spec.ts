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
});
