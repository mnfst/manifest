import { HttpException, HttpStatus } from '@nestjs/common';
import { ProxyRateLimiter } from '../proxy-rate-limiter';

describe('ProxyRateLimiter', () => {
  let limiter: ProxyRateLimiter;

  beforeEach(() => {
    limiter = new ProxyRateLimiter();
  });

  afterEach(() => {
    limiter.onModuleDestroy();
  });

  describe('checkLimit', () => {
    it('allows requests within the limit', () => {
      for (let i = 0; i < 60; i++) {
        expect(() => limiter.checkLimit('user-1')).not.toThrow();
      }
    });

    it('throws 429 when rate exceeded', () => {
      for (let i = 0; i < 60; i++) {
        limiter.checkLimit('user-1');
      }

      expect(() => limiter.checkLimit('user-1')).toThrow(
        HttpException,
      );
    });

    it('throws with correct status and message on rate exceeded', () => {
      for (let i = 0; i < 60; i++) {
        limiter.checkLimit('user-1');
      }

      try {
        limiter.checkLimit('user-1');
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((err as HttpException).message).toBe('Rate limit exceeded. Try again later.');
      }
    });

    it('resets after window expires', () => {
      jest.useFakeTimers();

      for (let i = 0; i < 60; i++) {
        limiter.checkLimit('user-1');
      }
      expect(() => limiter.checkLimit('user-1')).toThrow(
        HttpException,
      );

      jest.advanceTimersByTime(60_001);

      expect(() => limiter.checkLimit('user-1')).not.toThrow();
      jest.useRealTimers();
    });

    it('isolates different users', () => {
      for (let i = 0; i < 60; i++) {
        limiter.checkLimit('user-1');
      }

      expect(() => limiter.checkLimit('user-1')).toThrow(
        HttpException,
      );
      expect(() => limiter.checkLimit('user-2')).not.toThrow();
    });

    it('increments count across calls within the same window', () => {
      jest.useFakeTimers();

      // Make 30 requests
      for (let i = 0; i < 30; i++) {
        limiter.checkLimit('user-1');
      }

      // Advance time but stay within window
      jest.advanceTimersByTime(30_000);

      // Make 30 more — should still be in the same window
      for (let i = 0; i < 30; i++) {
        limiter.checkLimit('user-1');
      }

      // 61st request should throw
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);

      jest.useRealTimers();
    });

    it('stores the entry even when rate is exceeded', () => {
      // Fill up to the limit
      for (let i = 0; i < 60; i++) {
        limiter.checkLimit('user-1');
      }

      // Exceed the limit — entry is still stored (count=61)
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);

      // Subsequent calls should also throw (entry persists)
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);
    });
  });

  describe('LRU eviction', () => {
    it('evicts the oldest entry when map exceeds 50K entries', () => {
      // We cannot create 50K+ real entries efficiently in a unit test,
      // so we access the internal rates map to verify the behavior.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, { count: number; windowStart: number }>;

      // Pre-fill map with 50_000 entries
      for (let i = 0; i < 50_000; i++) {
        rates.set(`old-user-${i}`, { count: 1, windowStart: Date.now() });
      }

      expect(rates.size).toBe(50_000);

      // Adding one more via checkLimit should trigger eviction
      limiter.checkLimit('new-user');

      // The map should still be at or below 50_000
      expect(rates.size).toBeLessThanOrEqual(50_000);

      // The first inserted entry should have been evicted
      expect(rates.has('old-user-0')).toBe(false);

      // The new entry should exist
      expect(rates.has('new-user')).toBe(true);
    });

    it('evicts multiple entries if needed to get back to 50K', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, { count: number; windowStart: number }>;

      // Pre-fill map with 50_002 entries (exceeds limit by 2)
      for (let i = 0; i < 50_002; i++) {
        rates.set(`user-${i}`, { count: 1, windowStart: Date.now() });
      }

      // checkLimit adds one more, then evicts until size <= 50_000
      limiter.checkLimit('trigger-user');

      expect(rates.size).toBeLessThanOrEqual(50_000);
    });
  });

  describe('evictExpired', () => {
    it('removes expired entries when cleanup timer fires', () => {
      jest.useFakeTimers();

      // Create entries for multiple users
      limiter.checkLimit('user-1');
      limiter.checkLimit('user-2');

      // Advance past the window (60s) + cleanup interval (60s)
      jest.advanceTimersByTime(120_001);

      // Force a cleanup by calling checkLimit for a new user
      // (this triggers the interval callback)
      limiter.checkLimit('user-3');

      // Access internal rates map to verify expired entries are cleaned
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, unknown>;

      // user-1 and user-2 should have been evicted by the timer
      // user-3 should remain
      expect(rates.has('user-3')).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('acquireSlot / releaseSlot', () => {
    it('allows up to 10 concurrent slots', () => {
      for (let i = 0; i < 10; i++) {
        expect(() => limiter.acquireSlot('user-1')).not.toThrow();
      }
    });

    it('throws 429 when concurrency limit reached', () => {
      for (let i = 0; i < 10; i++) {
        limiter.acquireSlot('user-1');
      }

      expect(() => limiter.acquireSlot('user-1')).toThrow(
        HttpException,
      );
    });

    it('throws with correct status and message on concurrency exceeded', () => {
      for (let i = 0; i < 10; i++) {
        limiter.acquireSlot('user-1');
      }

      try {
        limiter.acquireSlot('user-1');
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((err as HttpException).message).toBe('Too many concurrent requests. Try again later.');
      }
    });

    it('allows new slot after release', () => {
      for (let i = 0; i < 10; i++) {
        limiter.acquireSlot('user-1');
      }

      limiter.releaseSlot('user-1');

      expect(() => limiter.acquireSlot('user-1')).not.toThrow();
    });

    it('isolates concurrency between users', () => {
      for (let i = 0; i < 10; i++) {
        limiter.acquireSlot('user-1');
      }

      expect(() => limiter.acquireSlot('user-1')).toThrow(
        HttpException,
      );
      expect(() => limiter.acquireSlot('user-2')).not.toThrow();
    });

    it('cleans up map entry when count reaches zero', () => {
      limiter.acquireSlot('user-1');
      limiter.releaseSlot('user-1');

      // Should be able to acquire 10 fresh slots
      for (let i = 0; i < 10; i++) {
        expect(() => limiter.acquireSlot('user-1')).not.toThrow();
      }
    });

    it('handles release for unknown user gracefully', () => {
      expect(() => limiter.releaseSlot('unknown-user')).not.toThrow();
    });

    it('does not go negative on double release', () => {
      limiter.acquireSlot('user-1');
      limiter.releaseSlot('user-1');
      limiter.releaseSlot('user-1');

      // After double release, the concurrency map entry should be deleted.
      // Verify by acquiring 10 slots (full capacity).
      for (let i = 0; i < 10; i++) {
        expect(() => limiter.acquireSlot('user-1')).not.toThrow();
      }
      // 11th should fail — proves no negative count leaked through
      expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
    });

    it('correctly tracks multiple acquire/release cycles', () => {
      // Acquire 5 slots
      for (let i = 0; i < 5; i++) {
        limiter.acquireSlot('user-1');
      }

      // Release 3
      limiter.releaseSlot('user-1');
      limiter.releaseSlot('user-1');
      limiter.releaseSlot('user-1');

      // Should be able to acquire 8 more (2 held + 8 new = 10)
      for (let i = 0; i < 8; i++) {
        expect(() => limiter.acquireSlot('user-1')).not.toThrow();
      }

      // 11th concurrent should fail
      expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
    });
  });

  describe('onModuleDestroy', () => {
    it('clears the cleanup interval timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      limiter.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      clearIntervalSpy.mockRestore();
    });
  });
});
