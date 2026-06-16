import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cachedFetch,
  isCacheable,
  invalidate,
  invalidatePredicate,
  invalidateAll,
  invalidateGroup,
  INVALIDATION_GROUPS,
  DEFAULT_TTL_MS,
} from '../../../src/services/api/cache';

describe('api SWR cache', () => {
  beforeEach(() => {
    invalidateAll();
  });
  afterEach(() => {
    vi.useRealTimers();
    invalidateAll();
  });

  describe('cachedFetch', () => {
    it('fetches and stores on a cache miss', async () => {
      const fetcher = vi.fn().mockResolvedValue({ n: 1 });
      const out = await cachedFetch('/api/v1/overview', fetcher);
      expect(out).toEqual({ n: 1 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('serves a fresh cached entry without hitting the network', async () => {
      const fetcher = vi.fn().mockResolvedValue({ n: 1 });
      await cachedFetch('/api/v1/overview', fetcher);
      const second = await cachedFetch('/api/v1/overview', fetcher);
      expect(second).toEqual({ n: 1 });
      // Second read is a fresh hit — no additional fetch.
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('de-dupes concurrent identical GETs via a shared in-flight promise', async () => {
      let resolve!: (v: { n: number }) => void;
      const fetcher = vi.fn().mockReturnValue(
        new Promise<{ n: number }>((r) => {
          resolve = r;
        }),
      );
      const p1 = cachedFetch('/api/v1/messages', fetcher);
      const p2 = cachedFetch('/api/v1/messages', fetcher);
      // Both calls share one underlying fetch.
      expect(fetcher).toHaveBeenCalledTimes(1);
      resolve({ n: 7 });
      expect(await p1).toEqual({ n: 7 });
      expect(await p2).toEqual({ n: 7 });
    });

    it('revalidates in the background after the TTL expires (stale-while-revalidate)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockResolvedValueOnce({ n: 2 });

      const first = await cachedFetch('/api/v1/costs', fetcher);
      expect(first).toEqual({ n: 1 });

      // Advance past the TTL so the entry is stale.
      vi.setSystemTime(DEFAULT_TTL_MS + 1);
      const stale = await cachedFetch('/api/v1/costs', fetcher);
      // SWR returns the stale value immediately...
      expect(stale).toEqual({ n: 1 });
      // ...while a background revalidation runs.
      expect(fetcher).toHaveBeenCalledTimes(2);

      // Let the background promise settle, then the next read sees fresh data.
      await vi.runAllTimersAsync();
      const fresh = await cachedFetch('/api/v1/costs', fetcher);
      expect(fresh).toEqual({ n: 2 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not double-fetch while a background revalidation is already in flight', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      let resolveSecond!: (v: { n: number }) => void;
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockReturnValueOnce(
          new Promise<{ n: number }>((r) => {
            resolveSecond = r;
          }),
        );

      await cachedFetch('/api/v1/tokens', fetcher);
      vi.setSystemTime(DEFAULT_TTL_MS + 1);
      // First stale read kicks off revalidation #2 (still pending).
      const a = await cachedFetch('/api/v1/tokens', fetcher);
      // Second stale read returns stale data, sharing the in-flight revalidation.
      const b = await cachedFetch('/api/v1/tokens', fetcher);
      expect(a).toEqual({ n: 1 });
      expect(b).toEqual({ n: 1 });
      expect(fetcher).toHaveBeenCalledTimes(2);
      resolveSecond({ n: 9 });
      await vi.runAllTimersAsync();
    });

    it('awaits the in-flight promise on a miss when no prior data exists', async () => {
      let resolve!: (v: { n: number }) => void;
      const fetcher = vi.fn().mockReturnValue(
        new Promise<{ n: number }>((r) => {
          resolve = r;
        }),
      );
      const p1 = cachedFetch('/api/v1/usage', fetcher);
      // Second concurrent miss returns the same in-flight promise (no data yet).
      const p2 = cachedFetch('/api/v1/usage', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      resolve({ n: 3 });
      expect(await p1).toEqual({ n: 3 });
      expect(await p2).toEqual({ n: 3 });
    });

    it('does not cache a failed fetch and retries on the next call', async () => {
      const fetcher = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ n: 5 });
      await expect(cachedFetch('/api/v1/overview', fetcher)).rejects.toThrow('boom');
      // The failed key is empty, so the next call refetches and succeeds.
      const out = await cachedFetch('/api/v1/overview', fetcher);
      expect(out).toEqual({ n: 5 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('keeps stale data when a background revalidation fails', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockRejectedValueOnce(new Error('revalidate failed'))
        .mockResolvedValueOnce({ n: 2 });

      await cachedFetch('/api/v1/overview', fetcher);
      vi.setSystemTime(DEFAULT_TTL_MS + 1);
      // Stale read returns old data immediately; background revalidation rejects.
      const stale = await cachedFetch('/api/v1/overview', fetcher);
      expect(stale).toEqual({ n: 1 });
      await vi.runAllTimersAsync();

      // The failed revalidation did NOT evict the good value — but it cleared the
      // in-flight slot, so the entry is still stale and the next call refetches.
      const retried = await cachedFetch('/api/v1/overview', fetcher);
      expect(retried).toEqual({ n: 1 });
      await vi.runAllTimersAsync();
      const fresh = await cachedFetch('/api/v1/overview', fetcher);
      expect(fresh).toEqual({ n: 2 });
    });
  });

  describe('isCacheable', () => {
    it('returns true for ordinary GET URLs', () => {
      expect(isCacheable('/api/v1/overview?range=7d')).toBe(true);
      expect(isCacheable('/api/v1/messages')).toBe(true);
    });

    it('denies always-fresh/sensitive endpoints', () => {
      expect(isCacheable('/api/auth/get-session')).toBe(false);
      expect(isCacheable('/api/v1/agents/demo/key')).toBe(false);
      expect(isCacheable('/api/v1/agents/demo/rotate-key')).toBe(false);
      expect(isCacheable('/api/v1/events')).toBe(false);
      expect(isCacheable('/api/v1/health')).toBe(false);
    });
  });

  describe('invalidate / invalidatePredicate / invalidateAll', () => {
    it('drops only keys matching the prefix', async () => {
      const f = (val: number) => () => Promise.resolve(val);
      await cachedFetch('/api/v1/overview', f(1));
      await cachedFetch('/api/v1/messages', f(2));
      invalidate('/api/v1/overview');
      const overviewFetcher = vi.fn().mockResolvedValue(10);
      const messagesFetcher = vi.fn().mockResolvedValue(20);
      // Overview was invalidated → refetches; messages is still cached → no fetch.
      await cachedFetch('/api/v1/overview', overviewFetcher);
      await cachedFetch('/api/v1/messages', messagesFetcher);
      expect(overviewFetcher).toHaveBeenCalledTimes(1);
      expect(messagesFetcher).not.toHaveBeenCalled();
    });

    it('drops keys matching a predicate', async () => {
      await cachedFetch('/api/v1/overview', () => Promise.resolve(1));
      invalidatePredicate((url) => url.includes('overview'));
      const fetcher = vi.fn().mockResolvedValue(2);
      await cachedFetch('/api/v1/overview', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('clears everything', async () => {
      await cachedFetch('/api/v1/overview', () => Promise.resolve(1));
      await cachedFetch('/api/v1/messages', () => Promise.resolve(2));
      invalidateAll();
      const a = vi.fn().mockResolvedValue(10);
      const b = vi.fn().mockResolvedValue(20);
      await cachedFetch('/api/v1/overview', a);
      await cachedFetch('/api/v1/messages', b);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateGroup', () => {
    it('invalidates every fragment in a group', async () => {
      // Seed one key per fragment of the message group, plus an unrelated key.
      for (const fragment of INVALIDATION_GROUPS.message) {
        await cachedFetch(`/api/v1${fragment}`, () => Promise.resolve(1));
      }
      await cachedFetch('/api/v1/agents', () => Promise.resolve(99));

      invalidateGroup('message');

      // Every message-group key refetches.
      for (const fragment of INVALIDATION_GROUPS.message) {
        const fetcher = vi.fn().mockResolvedValue(2);
        await cachedFetch(`/api/v1${fragment}`, fetcher);
        expect(fetcher).toHaveBeenCalledTimes(1);
      }
      // The unrelated /agents key survived.
      const agentsFetcher = vi.fn().mockResolvedValue(100);
      await cachedFetch('/api/v1/agents', agentsFetcher);
      expect(agentsFetcher).not.toHaveBeenCalled();
    });

    it('routing group invalidates routing/provider keys', async () => {
      await cachedFetch('/api/v1/routing/demo', () => Promise.resolve(1));
      invalidateGroup('routing');
      const fetcher = vi.fn().mockResolvedValue(2);
      await cachedFetch('/api/v1/routing/demo', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('agent group invalidates agent-list and per-agent keys', async () => {
      await cachedFetch('/api/v1/agents', () => Promise.resolve(1));
      await cachedFetch('/api/v1/agent/demo/usage', () => Promise.resolve(2));
      invalidateGroup('agent');
      const a = vi.fn().mockResolvedValue(10);
      const b = vi.fn().mockResolvedValue(20);
      await cachedFetch('/api/v1/agents', a);
      await cachedFetch('/api/v1/agent/demo/usage', b);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });
});
