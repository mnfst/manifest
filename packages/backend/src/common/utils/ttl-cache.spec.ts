import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic get/set/delete/has/clear', () => {
    it('returns undefined for a missing key', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      expect(cache.get('missing')).toBeUndefined();
    });

    it('stores and retrieves a value', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      cache.set('a', 42);
      expect(cache.get('a')).toBe(42);
    });

    it('overwrites an existing key', () => {
      const cache = new TtlCache<string, string>({ maxSize: 10, ttlMs: 1000 });
      cache.set('k', 'old');
      cache.set('k', 'new');
      expect(cache.get('k')).toBe('new');
      expect(cache.size).toBe(1);
    });

    it('deletes a key and returns true', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
    });

    it('delete returns false for a missing key', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      expect(cache.delete('nope')).toBe(false);
    });

    it('has returns true for existing key and false for missing', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      cache.set('x', 10);
      expect(cache.has('x')).toBe(true);
      expect(cache.has('y')).toBe(false);
    });

    it('clear removes all entries', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    it('size reflects the number of entries', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 1000 });
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    it('get returns undefined for expired entries', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);

      jest.advanceTimersByTime(501);
      expect(cache.get('a')).toBeUndefined();
    });

    it('has returns false for expired entries', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);

      jest.advanceTimersByTime(501);
      expect(cache.has('a')).toBe(false);
    });

    it('expired entry is removed from store on get', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      jest.advanceTimersByTime(501);
      cache.get('a');
      expect(cache.size).toBe(0);
    });

    it('expired entry is removed from store on has', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      jest.advanceTimersByTime(501);
      cache.has('a');
      expect(cache.size).toBe(0);
    });

    it('entry at exact TTL boundary is considered expired', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      jest.advanceTimersByTime(500);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('size eviction', () => {
    it('evicts the oldest entry when maxSize is exceeded', () => {
      const cache = new TtlCache<string, number>({ maxSize: 3, ttlMs: 60_000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      expect(cache.size).toBe(3);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('d')).toBe(4);
    });

    it('does not evict when updating an existing key at capacity', () => {
      const cache = new TtlCache<string, number>({ maxSize: 3, ttlMs: 60_000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('b', 20);

      expect(cache.size).toBe(3);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(20);
      expect(cache.get('c')).toBe(3);
    });

    it('evicts multiple oldest entries as new ones are added', () => {
      const cache = new TtlCache<string, number>({ maxSize: 2, ttlMs: 60_000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      expect(cache.size).toBe(2);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });
  });

  describe('evictExpired', () => {
    it('removes all expired entries', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      cache.set('b', 2);

      jest.advanceTimersByTime(300);
      cache.set('c', 3);

      jest.advanceTimersByTime(201);
      // a and b are expired (501ms old), c is still valid (201ms old)
      cache.evictExpired();

      expect(cache.size).toBe(1);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('does nothing when no entries are expired', () => {
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 60_000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.evictExpired();
      expect(cache.size).toBe(2);
    });

    it('clears all entries when all are expired', () => {
      jest.useFakeTimers();
      const cache = new TtlCache<string, number>({ maxSize: 10, ttlMs: 500 });
      cache.set('a', 1);
      cache.set('b', 2);
      jest.advanceTimersByTime(501);
      cache.evictExpired();
      expect(cache.size).toBe(0);
    });
  });
});
