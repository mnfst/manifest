jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string>) => headers),
}));

jest.mock('./auth.instance', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionGuard } from './session.guard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require('./auth.instance');

function createMockContext(overrides: { ip?: string; headers?: Record<string, string> }): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const peerIp = overrides.ip ?? '127.0.0.1';
  const request: Record<string, unknown> = {
    ip: peerIp,
    socket: { remoteAddress: peerIp },
    headers: overrides.headers ?? {},
  };

  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('SessionGuard — cache edge cases', () => {
  let guard: SessionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new SessionGuard(reflector);
    jest.clearAllMocks();
  });

  afterEach(() => {
    guard.onModuleDestroy();
  });

  describe('whitespace-only cookie header', () => {
    it('hashes whitespace-only cookies (length > 0) and reuses the cache entry', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const mockSession = {
        user: { id: 'u-ws', name: 'WS', email: 'ws@test.com' },
        session: { id: 's-ws' },
      };
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);
      const headers = { cookie: '   ' };

      // First call: no cache, hits getSession and stores under the hashed key
      await guard.canActivate(createMockContext({ headers }).context);
      expect(auth.api.getSession).toHaveBeenCalledTimes(1);

      // Second call with the same whitespace cookie: should hit the cache.
      // This documents the current behavior — the guard only checks length > 0,
      // so a whitespace-only header is a valid cache key (just like any other
      // non-empty cookie). It is NOT treated as "no cookie".
      const second = createMockContext({ headers });
      const result = await guard.canActivate(second.context);

      expect(result).toBe(true);
      expect(auth.api.getSession).toHaveBeenCalledTimes(1);
      expect(second.request['user']).toEqual(mockSession.user);
      expect(second.request['authMethod']).toBe('session');
    });

    it('produces a different cache key than an empty cookie header', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const mockSession = {
        user: { id: 'u-x', name: 'X', email: 'x@test.com' },
        session: { id: 's-x' },
      };
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      // Empty string: skips cache entirely (length === 0 → cacheKey is null)
      await guard.canActivate(createMockContext({ headers: { cookie: '' } }).context);
      await guard.canActivate(createMockContext({ headers: { cookie: '' } }).context);
      expect(auth.api.getSession).toHaveBeenCalledTimes(2);

      // Whitespace-only: cached (length > 0)
      await guard.canActivate(createMockContext({ headers: { cookie: '   ' } }).context);
      await guard.canActivate(createMockContext({ headers: { cookie: '   ' } }).context);

      // Only one additional getSession call for whitespace (first stores, second hits cache)
      expect(auth.api.getSession).toHaveBeenCalledTimes(3);
    });

    it('treats different whitespace patterns as distinct cache keys', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: 'u-ws2', name: 'WS2', email: 'ws2@test.com' },
        session: { id: 's-ws2' },
      });

      await guard.canActivate(createMockContext({ headers: { cookie: ' ' } }).context);
      await guard.canActivate(createMockContext({ headers: { cookie: '\t' } }).context);
      await guard.canActivate(createMockContext({ headers: { cookie: '\n' } }).context);

      // Each is a different non-empty string → different hash → different cache key
      expect(auth.api.getSession).toHaveBeenCalledTimes(3);
    });
  });

  describe('concurrent cache eviction (parallel canActivate)', () => {
    it('preserves cache size <= MAX_CACHE_SIZE under parallel calls that trigger eviction', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          user: { id: 'u-par', name: 'P', email: 'p@test.com' },
          session: { id: 's-par' },
        }),
      );

      // Shrink the cap so the test is fast and deterministic. The eviction
      // logic is the same regardless of cap (`while (size >= MAX) delete first`).
      type WritableMax = { MAX_CACHE_SIZE: number };
      const MAX = 50;
      (guard as unknown as WritableMax).MAX_CACHE_SIZE = MAX;

      // Pre-fill the cache to exactly MAX entries.
      for (let i = 0; i < MAX; i++) {
        await guard.canActivate(createMockContext({ headers: { cookie: `pre-${i}` } }).context);
      }
      type WithCache = { cache: Map<string, unknown> };
      expect((guard as unknown as WithCache).cache.size).toBe(MAX);

      // Now fire many parallel calls with DISTINCT cookies. Each will await
      // getSession (resolved on the microtask queue), then synchronously
      // call storeInCache. Because async functions interleave between
      // awaits, multiple storeInCache calls can be pending at once — this
      // exercises the eviction loop under interleaved scheduling.
      const PARALLEL = 100;
      const contexts = Array.from(
        { length: PARALLEL },
        (_, i) => createMockContext({ headers: { cookie: `par-${i}` } }).context,
      );
      await Promise.all(contexts.map((c) => guard.canActivate(c)));

      // Invariant: the cache must never exceed its cap, even under parallel
      // eviction pressure. If the while loop or `keys().next()` ever skipped
      // a key, size would drift above MAX.
      expect((guard as unknown as WithCache).cache.size).toBeLessThanOrEqual(MAX);

      // Stronger: after the dust settles, the cache should be exactly at
      // (or below) cap. We inserted PARALLEL new keys on top of a full
      // cache, so the cap is the upper bound.
      expect((guard as unknown as WithCache).cache.size).toBe(MAX);
    });

    it('does not throw when storeInCache is called from many parallel awaiters', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          user: { id: 'u-safe', name: 'S', email: 's@test.com' },
          session: { id: 's-safe' },
        }),
      );

      type WritableMax = { MAX_CACHE_SIZE: number };
      (guard as unknown as WritableMax).MAX_CACHE_SIZE = 10;

      // Fire 50 distinct parallel requests against a cap of 10. The
      // `while (size >= MAX_CACHE_SIZE)` loop with `keys().next()` must
      // remain stable even when many writers are interleaved between awaits.
      const contexts = Array.from(
        { length: 50 },
        (_, i) => createMockContext({ headers: { cookie: `safe-${i}` } }).context,
      );

      await expect(Promise.all(contexts.map((c) => guard.canActivate(c)))).resolves.toEqual(
        Array(50).fill(true),
      );

      type WithCache = { cache: Map<string, unknown> };
      expect((guard as unknown as WithCache).cache.size).toBeLessThanOrEqual(10);
    });

    it('keeps a recently-touched entry when parallel new inserts evict the oldest', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          user: { id: 'u-lru', name: 'L', email: 'l@test.com' },
          session: { id: 's-lru' },
        }),
      );

      type WritableMax = { MAX_CACHE_SIZE: number };
      const MAX = 5;
      (guard as unknown as WritableMax).MAX_CACHE_SIZE = MAX;

      // Fill the cache and capture a "recent" key by touching it last.
      for (let i = 0; i < MAX; i++) {
        await guard.canActivate(createMockContext({ headers: { cookie: `lru-${i}` } }).context);
      }
      // Touch lru-0 so it moves to the tail of insertion order.
      await guard.canActivate(createMockContext({ headers: { cookie: 'lru-0' } }).context);

      const callsBefore = (auth.api.getSession as jest.Mock).mock.calls.length;

      // Now fire parallel new inserts that should evict the now-oldest entries
      // (lru-1, lru-2, ...), NOT lru-0.
      const contexts = Array.from(
        { length: 3 },
        (_, i) => createMockContext({ headers: { cookie: `new-${i}` } }).context,
      );
      await Promise.all(contexts.map((c) => guard.canActivate(c)));

      // lru-0 should still be cached: hitting it must NOT add a getSession call.
      await guard.canActivate(createMockContext({ headers: { cookie: 'lru-0' } }).context);
      expect((auth.api.getSession as jest.Mock).mock.calls.length).toBe(callsBefore + 3);
    });
  });
});
