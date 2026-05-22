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

  it('stores and retrieves reasoning_content', () => {
    cache.store('session-1', 'call_1', 'thinking');
    expect(cache.retrieve('session-1', 'call_1')).toBe('thinking');
  });

  it('returns null for a non-existent key', () => {
    expect(cache.retrieve('no-session', 'no-call')).toBeNull();
  });

  it('ignores empty reasoning_content', () => {
    cache.store('session-1', 'call_1', '');
    expect(cache.retrieve('session-1', 'call_1')).toBeNull();
  });

  it('returns null for an expired entry', () => {
    const realNow = Date.now;
    const baseTime = 1000000000000;

    Date.now = () => baseTime;
    cache.store('session-1', 'call_1', 'expired');

    Date.now = () => baseTime + 31 * 60 * 1000;
    expect(cache.retrieve('session-1', 'call_1')).toBeNull();

    Date.now = realNow;
  });

  it('returns content when it has not yet expired', () => {
    const realNow = Date.now;
    const baseTime = 1000000000000;

    Date.now = () => baseTime;
    cache.store('session-1', 'call_1', 'valid');

    Date.now = () => baseTime + 29 * 60 * 1000;
    expect(cache.retrieve('session-1', 'call_1')).toBe('valid');

    Date.now = realNow;
  });

  it('clearSession removes all entries for a given session', () => {
    cache.store('session-A', 'call_1', 'a');
    cache.store('session-A', 'call_2', 'b');
    cache.store('session-B', 'call_1', 'c');

    cache.clearSession('session-A');

    expect(cache.retrieve('session-A', 'call_1')).toBeNull();
    expect(cache.retrieve('session-A', 'call_2')).toBeNull();
    expect(cache.retrieve('session-B', 'call_1')).toBe('c');
  });

  it('stores entries for multiple sessions independently', () => {
    cache.store('s1', 'call_1', 'a');
    cache.store('s2', 'call_1', 'b');
    cache.store('s3', 'call_2', 'c');

    expect(cache.retrieve('s1', 'call_1')).toBe('a');
    expect(cache.retrieve('s2', 'call_1')).toBe('b');
    expect(cache.retrieve('s3', 'call_2')).toBe('c');
  });

  it('overwrites existing entry for the same session and tool call', () => {
    cache.store('session-1', 'call_1', 'old');
    cache.store('session-1', 'call_1', 'new');

    expect(cache.retrieve('session-1', 'call_1')).toBe('new');
  });

  it('evicts expired entries lazily when cleanup interval has elapsed', () => {
    const realNow = Date.now;
    const baseTime = 1000000000000;

    Date.now = () => baseTime;
    const localCache = new ReasoningContentCache();
    localCache.store('s1', 'call_1', 'first');

    Date.now = () => baseTime + 31 * 60 * 1000;
    localCache.store('s2', 'call_2', 'second');

    expect(localCache.retrieve('s1', 'call_1')).toBeNull();
    expect(localCache.retrieve('s2', 'call_2')).toBe('second');

    Date.now = realNow;
  });
});
