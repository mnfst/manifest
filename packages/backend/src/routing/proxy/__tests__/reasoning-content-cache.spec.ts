import { ReasoningContentCache } from '../reasoning-content-cache';

describe('ReasoningContentCache', () => {
  let cache: ReasoningContentCache;

  beforeEach(() => {
    cache = new ReasoningContentCache();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores and retrieves a reasoning_content string', () => {
    cache.store('session-1', 'call_abc', 'I need to think about this...');
    expect(cache.retrieve('session-1', 'call_abc')).toBe('I need to think about this...');
  });

  it('returns null for a non-existent key', () => {
    expect(cache.retrieve('no-session', 'no-call')).toBeNull();
  });

  it('store with empty string is a no-op', () => {
    cache.store('session-1', 'call_abc', '');
    expect(cache.retrieve('session-1', 'call_abc')).toBeNull();
  });

  it('returns null and deletes the entry when it has expired', () => {
    const realNow = Date.now;
    const baseTime = 1000000000000;

    Date.now = () => baseTime;
    cache.store('session-1', 'call_abc', 'reasoning');

    Date.now = () => baseTime + 31 * 60 * 1000;
    expect(cache.retrieve('session-1', 'call_abc')).toBeNull();

    // Entry should be deleted — second retrieve is still null
    expect(cache.retrieve('session-1', 'call_abc')).toBeNull();

    Date.now = realNow;
  });

  it('returns the content when it has not yet expired', () => {
    const realNow = Date.now;
    const baseTime = 1000000000000;

    Date.now = () => baseTime;
    cache.store('session-1', 'call_abc', 'reasoning');

    Date.now = () => baseTime + 29 * 60 * 1000;
    expect(cache.retrieve('session-1', 'call_abc')).toBe('reasoning');

    Date.now = realNow;
  });

  it('clearSession removes all entries for a given session', () => {
    cache.store('session-A', 'call_1', 'reasoning-a1');
    cache.store('session-A', 'call_2', 'reasoning-a2');
    cache.store('session-B', 'call_1', 'reasoning-b1');

    cache.clearSession('session-A');

    expect(cache.retrieve('session-A', 'call_1')).toBeNull();
    expect(cache.retrieve('session-A', 'call_2')).toBeNull();
    expect(cache.retrieve('session-B', 'call_1')).toBe('reasoning-b1');
  });

  it('clearSession does not throw for a non-existent session', () => {
    expect(() => cache.clearSession('unknown')).not.toThrow();
  });

  it('stores entries for multiple sessions independently', () => {
    cache.store('s1', 'call_1', 'r1');
    cache.store('s2', 'call_1', 'r2');
    cache.store('s3', 'call_2', 'r3');

    expect(cache.retrieve('s1', 'call_1')).toBe('r1');
    expect(cache.retrieve('s2', 'call_1')).toBe('r2');
    expect(cache.retrieve('s3', 'call_2')).toBe('r3');
  });

  it('overwrites an existing entry for the same session and tool call id', () => {
    cache.store('session-1', 'call_1', 'old reasoning');
    cache.store('session-1', 'call_1', 'new reasoning');
    expect(cache.retrieve('session-1', 'call_1')).toBe('new reasoning');
  });

  describe('maybeCleanup (lazy eviction)', () => {
    it('evicts expired entries when cleanup interval has elapsed', () => {
      const realNow = Date.now;
      const baseTime = 1000000000000;

      Date.now = () => baseTime;
      const localCache = new ReasoningContentCache();
      localCache.store('s1', 'call_1', 'first');

      // Advance past TTL (30 min) AND cleanup interval (5 min)
      Date.now = () => baseTime + 31 * 60 * 1000;

      // Store a new entry — this triggers maybeCleanup
      localCache.store('s2', 'call_2', 'second');

      // Expired entry should have been evicted
      expect(localCache.retrieve('s1', 'call_1')).toBeNull();
      // New entry is still valid
      expect(localCache.retrieve('s2', 'call_2')).toBe('second');

      Date.now = realNow;
    });

    it('does not evict entries when cleanup interval has not elapsed', () => {
      const realNow = Date.now;
      const baseTime = 1000000000000;

      Date.now = () => baseTime;
      const localCache = new ReasoningContentCache();
      localCache.store('s1', 'call_1', 'first');

      // Advance only 2 minutes (less than 5 min cleanup interval)
      Date.now = () => baseTime + 2 * 60 * 1000;
      localCache.store('s2', 'call_2', 'second');

      // s1 has not expired (only 2 min, TTL is 30 min)
      expect(localCache.retrieve('s1', 'call_1')).toBe('first');
      expect(localCache.retrieve('s2', 'call_2')).toBe('second');

      Date.now = realNow;
    });
  });
});
