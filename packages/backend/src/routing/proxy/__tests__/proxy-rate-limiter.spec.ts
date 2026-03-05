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
    it('allows requests when no successes recorded', () => {
      // checkLimit alone never throws since it does not increment
      for (let i = 0; i < 300; i++) {
        expect(() => limiter.checkLimit('user-1')).not.toThrow();
      }
    });

    it('allows requests within the limit', () => {
      for (let i = 0; i < 200; i++) {
        limiter.recordSuccess('user-1');
      }
      // At exactly 200, the next checkLimit should throw
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);
    });

    it('throws 429 when rate exceeded', () => {
      for (let i = 0; i < 200; i++) {
        limiter.recordSuccess('user-1');
      }

      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);
    });

    it('throws with correct status and message on rate exceeded', () => {
      for (let i = 0; i < 200; i++) {
        limiter.recordSuccess('user-1');
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

      for (let i = 0; i < 200; i++) {
        limiter.recordSuccess('user-1');
      }
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);

      jest.advanceTimersByTime(60_001);

      expect(() => limiter.checkLimit('user-1')).not.toThrow();
      jest.useRealTimers();
    });

    it('isolates different users', () => {
      for (let i = 0; i < 200; i++) {
        limiter.recordSuccess('user-1');
      }

      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);
      expect(() => limiter.checkLimit('user-2')).not.toThrow();
    });
  });

  describe('recordSuccess', () => {
    it('increments count across calls within the same window', () => {
      jest.useFakeTimers();

      for (let i = 0; i < 100; i++) {
        limiter.recordSuccess('user-1');
      }

      // Advance time but stay within window
      jest.advanceTimersByTime(30_000);

      for (let i = 0; i < 100; i++) {
        limiter.recordSuccess('user-1');
      }

      // 201st request should be blocked
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);

      jest.useRealTimers();
    });

    it('does not count failed requests (checkLimit without recordSuccess)', () => {
      // Simulate 300 failed requests (only checkLimit, no recordSuccess)
      for (let i = 0; i < 300; i++) {
        limiter.checkLimit('user-1');
      }

      // Should still allow because no successes were recorded
      expect(() => limiter.checkLimit('user-1')).not.toThrow();
    });

    it('resets window after expiry', () => {
      jest.useFakeTimers();

      for (let i = 0; i < 200; i++) {
        limiter.recordSuccess('user-1');
      }
      expect(() => limiter.checkLimit('user-1')).toThrow(HttpException);

      jest.advanceTimersByTime(60_001);

      limiter.recordSuccess('user-1');
      expect(() => limiter.checkLimit('user-1')).not.toThrow();

      jest.useRealTimers();
    });
  });

  describe('LRU eviction', () => {
    it('evicts the oldest entry when map exceeds 50K entries', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, { count: number; windowStart: number }>;

      for (let i = 0; i < 50_000; i++) {
        rates.set(`old-user-${i}`, { count: 1, windowStart: Date.now() });
      }

      expect(rates.size).toBe(50_000);

      limiter.recordSuccess('new-user');

      expect(rates.size).toBeLessThanOrEqual(50_000);
      expect(rates.has('old-user-0')).toBe(false);
      expect(rates.has('new-user')).toBe(true);
    });
  });

  describe('evictExpired', () => {
    it('removes expired entries when cleanup timer fires', () => {
      jest.useFakeTimers();

      limiter.recordSuccess('user-1');
      limiter.recordSuccess('user-2');

      jest.advanceTimersByTime(120_001);

      limiter.recordSuccess('user-3');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, unknown>;
      expect(rates.has('user-3')).toBe(true);

      jest.useRealTimers();
    });

    it('evicts expired entries when evictExpired is called directly', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, { count: number; windowStart: number }>;

      // Insert entries with old timestamps (expired)
      rates.set('old-user', { count: 5, windowStart: Date.now() - 120_000 });
      rates.set('fresh-user', { count: 2, windowStart: Date.now() });

      expect(rates.size).toBe(2);

      // Call evictExpired directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (limiter as any).evictExpired();

      expect(rates.has('old-user')).toBe(false);
      expect(rates.has('fresh-user')).toBe(true);
      expect(rates.size).toBe(1);
    });

    it('does not evict entries within the rate window', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (limiter as any).rates as Map<string, { count: number; windowStart: number }>;

      rates.set('recent-user', { count: 3, windowStart: Date.now() - 30_000 }); // 30s ago, within 60s window

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (limiter as any).evictExpired();

      expect(rates.has('recent-user')).toBe(true);
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

      expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
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
        expect((err as HttpException).message).toBe(
          'Too many concurrent requests. Try again later.',
        );
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

      expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
      expect(() => limiter.acquireSlot('user-2')).not.toThrow();
    });

    it('cleans up map entry when count reaches zero', () => {
      limiter.acquireSlot('user-1');
      limiter.releaseSlot('user-1');

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

      for (let i = 0; i < 10; i++) {
        expect(() => limiter.acquireSlot('user-1')).not.toThrow();
      }
      expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
    });
  });

  describe('cleanup timer callback', () => {
    it('fires the interval callback to evict expired entries', () => {
      jest.useFakeTimers();

      const timedLimiter = new ProxyRateLimiter();

      // Record some entries
      timedLimiter.recordSuccess('user-old');

      // Manually expire the entry by manipulating the internal map
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rates = (timedLimiter as any).rates as Map<
        string,
        { count: number; windowStart: number }
      >;
      rates.get('user-old')!.windowStart = Date.now() - 120_000;

      timedLimiter.recordSuccess('user-new');
      // Set user-new's windowStart so it survives the 60001ms time advance.
      // After advancing, Date.now() increases by 60001, so we need:
      //   (Date.now() + 60001) - windowStart < 60000
      // Setting windowStart = Date.now() + 2 gives 59999 < 60000.
      rates.get('user-new')!.windowStart = Date.now() + 2;

      // Advance past the cleanup interval (60s)
      jest.advanceTimersByTime(60_001);

      // The interval callback should have triggered evictExpired
      expect(rates.has('user-old')).toBe(false);
      expect(rates.has('user-new')).toBe(true);

      timedLimiter.onModuleDestroy();
      jest.useRealTimers();
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
