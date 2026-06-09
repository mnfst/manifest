import {
  ProviderCircuitBreakerService,
  CIRCUIT_BREAKER_DEFAULTS,
} from '../provider-circuit-breaker.service';

const CB_ENV_KEYS = [
  'MANIFEST_CIRCUIT_BREAKER_DISABLED',
  'MANIFEST_CB_WINDOW_MS',
  'MANIFEST_CB_MIN_REQUESTS',
  'MANIFEST_CB_FAILURE_RATIO',
  'MANIFEST_CB_COOLDOWN_MS',
];

/** Construct a breaker with a controlled env (config is read at construction). */
function buildBreaker(env: Record<string, string> = {}): ProviderCircuitBreakerService {
  const saved: Record<string, string | undefined> = {};
  for (const k of CB_ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try {
    return new ProviderCircuitBreakerService();
  } finally {
    for (const k of CB_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const KEY = 'openai:api_key';

function tripOpen(cb: ProviderCircuitBreakerService, key = KEY): void {
  // minRequests failures at 100% ratio trips the breaker.
  for (let i = 0; i < CIRCUIT_BREAKER_DEFAULTS.minRequests; i++) cb.recordFailure(key);
}

describe('ProviderCircuitBreakerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-04T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('exposes the documented defaults', () => {
    expect(CIRCUIT_BREAKER_DEFAULTS).toEqual({
      windowMs: 30_000,
      minRequests: 20,
      failureRatio: 0.5,
      cooldownMs: 30_000,
      maxEntries: 5_000,
    });
  });

  describe('closed state', () => {
    it('is not open with no history', () => {
      expect(buildBreaker().isOpen(KEY)).toBe(false);
    });

    it('stays closed below the minimum request volume even at 100% failure', () => {
      const cb = buildBreaker();
      for (let i = 0; i < CIRCUIT_BREAKER_DEFAULTS.minRequests - 1; i++) cb.recordFailure(KEY);
      expect(cb.isOpen(KEY)).toBe(false);
    });

    it('stays closed when the failure ratio is below threshold', () => {
      const cb = buildBreaker();
      for (let i = 0; i < 9; i++) cb.recordFailure(KEY);
      for (let i = 0; i < 11; i++) cb.record(KEY, 200);
      expect(cb.isOpen(KEY)).toBe(false);
    });

    it('does NOT count 429 / 4xx as failures', () => {
      const cb = buildBreaker();
      for (let i = 0; i < 30; i++) cb.record(KEY, 429);
      expect(cb.isOpen(KEY)).toBe(false);
    });

    it('rolls the window so stale failures fall off', () => {
      const cb = buildBreaker();
      for (let i = 0; i < 19; i++) cb.recordFailure(KEY);
      jest.advanceTimersByTime(31_000); // past windowMs → counters reset
      cb.recordFailure(KEY);
      cb.record(KEY, 200);
      expect(cb.isOpen(KEY)).toBe(false);
    });
  });

  describe('tripping open', () => {
    it('opens once the minimum volume and ratio are met (HTTP 5xx counts)', () => {
      const cb = buildBreaker();
      for (let i = 0; i < CIRCUIT_BREAKER_DEFAULTS.minRequests; i++) cb.record(KEY, 503);
      expect(cb.isOpen(KEY)).toBe(true);
    });

    it('opens at exactly the 50% ratio', () => {
      const cb = buildBreaker();
      for (let i = 0; i < 10; i++) cb.recordFailure(KEY);
      for (let i = 0; i < 10; i++) cb.record(KEY, 200);
      expect(cb.isOpen(KEY)).toBe(true);
    });

    it('isolates breakers per key', () => {
      const cb = buildBreaker();
      tripOpen(cb, 'openai:api_key');
      expect(cb.isOpen('openai:api_key')).toBe(true);
      expect(cb.isOpen('anthropic:api_key')).toBe(false);
    });
  });

  describe('open → half-open → recovery', () => {
    it('fast-fails while open, then allows exactly one probe after cooldown', () => {
      const cb = buildBreaker();
      tripOpen(cb);
      expect(cb.isOpen(KEY)).toBe(true); // still cooling down

      jest.advanceTimersByTime(CIRCUIT_BREAKER_DEFAULTS.cooldownMs);
      expect(cb.isOpen(KEY)).toBe(false); // probe slot
      expect(cb.isOpen(KEY)).toBe(true); // others blocked until probe resolves
    });

    it('closes the breaker when the probe succeeds', () => {
      const cb = buildBreaker();
      tripOpen(cb);
      jest.advanceTimersByTime(CIRCUIT_BREAKER_DEFAULTS.cooldownMs);
      cb.isOpen(KEY); // take the probe slot
      cb.record(KEY, 200); // probe success
      expect(cb.isOpen(KEY)).toBe(false);
    });

    it('reopens when the probe fails', () => {
      const cb = buildBreaker();
      tripOpen(cb);
      jest.advanceTimersByTime(CIRCUIT_BREAKER_DEFAULTS.cooldownMs);
      cb.isOpen(KEY); // probe slot
      cb.recordFailure(KEY); // probe fails
      expect(cb.isOpen(KEY)).toBe(true);
    });

    it('abortProbe releases a stuck probe but still admits exactly one re-probe', () => {
      const cb = buildBreaker();
      tripOpen(cb);
      jest.advanceTimersByTime(CIRCUIT_BREAKER_DEFAULTS.cooldownMs);
      cb.isOpen(KEY); // probe in flight
      expect(cb.isOpen(KEY)).toBe(true); // blocked
      cb.abortProbe(KEY);
      expect(cb.isOpen(KEY)).toBe(false); // re-probe admitted (claims the slot)
      expect(cb.isOpen(KEY)).toBe(true); // concurrent request blocked — exactly one
    });

    it('abortProbe is a no-op when there is no half-open probe', () => {
      const cb = buildBreaker();
      expect(() => cb.abortProbe(KEY)).not.toThrow(); // no entry
      cb.record(KEY, 200);
      expect(() => cb.abortProbe(KEY)).not.toThrow(); // closed entry
      expect(cb.isOpen(KEY)).toBe(false);
    });
  });

  describe('disabled', () => {
    it('never opens and never records when disabled', () => {
      const cb = buildBreaker({ MANIFEST_CIRCUIT_BREAKER_DISABLED: '1' });
      tripOpen(cb);
      expect(cb.isOpen(KEY)).toBe(false);
    });
  });

  describe('env overrides', () => {
    it('honors numeric overrides', () => {
      const cb = buildBreaker({ MANIFEST_CB_MIN_REQUESTS: '2', MANIFEST_CB_FAILURE_RATIO: '0.5' });
      cb.recordFailure(KEY);
      cb.recordFailure(KEY);
      expect(cb.isOpen(KEY)).toBe(true);
    });

    it('falls back to defaults for invalid numeric / out-of-range overrides', () => {
      const cbHigh = buildBreaker({
        MANIFEST_CB_MIN_REQUESTS: 'abc',
        MANIFEST_CB_FAILURE_RATIO: '5', // ratio must be in (0, 1]
        MANIFEST_CB_COOLDOWN_MS: '0',
      });
      cbHigh.recordFailure(KEY);
      cbHigh.recordFailure(KEY);
      expect(cbHigh.isOpen(KEY)).toBe(false); // default min 20 still applies

      const cbZero = buildBreaker({ MANIFEST_CB_FAILURE_RATIO: '0' });
      tripOpen(cbZero);
      expect(cbZero.isOpen(KEY)).toBe(true); // default ratio 0.5 still applies
    });
  });

  describe('memory bound', () => {
    it('evicts the oldest key once maxEntries is reached', () => {
      const cb = buildBreaker();
      for (let i = 0; i < CIRCUIT_BREAKER_DEFAULTS.maxEntries; i++) {
        cb.recordFailure(`p-${i}:api_key`);
      }
      cb.recordFailure('p-new:api_key'); // evicts the oldest (p-0)
      expect(cb.isOpen('p-new:api_key')).toBe(false);
    });
  });
});
