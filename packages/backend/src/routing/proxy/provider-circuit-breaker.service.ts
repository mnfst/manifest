import { Injectable } from '@nestjs/common';

/**
 * Per-(provider, auth-type) circuit breaker for upstream LLM calls.
 *
 * When a provider starts failing (connection errors or HTTP 5xx), the breaker
 * trips OPEN and subsequent calls "fast-fail" — the proxy skips the upstream
 * request and lets the fallback chain take over immediately, instead of paying
 * the full connect timeout on every request to a provider that is already down.
 * After a cooldown it allows a single HALF-OPEN probe; the probe's outcome
 * either CLOSES the breaker (recovered) or reopens it.
 *
 * 429s and other 4xx do NOT count as failures — the provider is up, just
 * throttling or rejecting the request, which the fallback / key-rotation paths
 * already handle. Only status >= 500 and transport failures count.
 *
 * State is in-memory per process (like the routing caches). Disable entirely
 * with MANIFEST_CIRCUIT_BREAKER_DISABLED=1.
 */

type BreakerState = 'closed' | 'open' | 'half_open';

interface BreakerEntry {
  state: BreakerState;
  failures: number;
  total: number;
  windowStart: number;
  openedAt: number;
  probeInFlight: boolean;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envRatio(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw !== undefined ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}

export const CIRCUIT_BREAKER_DEFAULTS = {
  /** Rolling window over which the failure ratio is measured (ms). */
  windowMs: 30_000,
  /** Minimum attempts in the window before the breaker may trip. */
  minRequests: 20,
  /** Failure ratio (0..1] that trips the breaker once minRequests is met. */
  failureRatio: 0.5,
  /** How long the breaker stays OPEN before allowing a half-open probe (ms). */
  cooldownMs: 30_000,
  /** Cap on tracked (provider, auth) keys to bound memory. */
  maxEntries: 5_000,
} as const;

@Injectable()
export class ProviderCircuitBreakerService {
  private readonly entries = new Map<string, BreakerEntry>();
  private readonly disabled = process.env['MANIFEST_CIRCUIT_BREAKER_DISABLED'] === '1';
  private readonly windowMs = envInt('MANIFEST_CB_WINDOW_MS', CIRCUIT_BREAKER_DEFAULTS.windowMs);
  private readonly minRequests = envInt(
    'MANIFEST_CB_MIN_REQUESTS',
    CIRCUIT_BREAKER_DEFAULTS.minRequests,
  );
  private readonly failureRatio = envRatio(
    'MANIFEST_CB_FAILURE_RATIO',
    CIRCUIT_BREAKER_DEFAULTS.failureRatio,
  );
  private readonly cooldownMs = envInt(
    'MANIFEST_CB_COOLDOWN_MS',
    CIRCUIT_BREAKER_DEFAULTS.cooldownMs,
  );

  /** True when the breaker for `key` is OPEN and the caller should fast-fail. */
  isOpen(key: string): boolean {
    if (this.disabled) return false;
    const entry = this.entries.get(key);
    if (!entry || entry.state === 'closed') return false;

    if (entry.state === 'open') {
      if (Date.now() - entry.openedAt >= this.cooldownMs) {
        // Cooldown elapsed → let exactly one probe through to test recovery.
        entry.state = 'half_open';
        entry.probeInFlight = true;
        return false;
      }
      return true;
    }

    // half_open: admit exactly one probe and claim the slot, so concurrent
    // requests (e.g. after an aborted probe cleared the flag) are blocked
    // rather than all becoming probes.
    if (entry.probeInFlight) return true;
    entry.probeInFlight = true;
    return false;
  }

  /** Record an attempt's HTTP status (>= 500 counts as a failure). */
  record(key: string, status: number): void {
    this.note(key, status >= 500);
  }

  /** Record a transport / connection failure (no HTTP status). */
  recordFailure(key: string): void {
    this.note(key, true);
  }

  /**
   * Clear an in-flight half-open probe without scoring it — used when the
   * attempt ended for a non-provider reason (client abort, programming error),
   * so the next eligible request can re-probe instead of being stuck.
   */
  abortProbe(key: string): void {
    const entry = this.entries.get(key);
    if (entry?.state === 'half_open') entry.probeInFlight = false;
  }

  private note(key: string, failed: boolean): void {
    if (this.disabled) return;
    const now = Date.now();
    const entry = this.getOrCreate(key, now);

    if (entry.state === 'half_open') {
      if (failed) {
        entry.state = 'open';
        entry.openedAt = now;
        entry.probeInFlight = false;
      } else {
        this.reset(entry, now);
      }
      return;
    }

    if (now - entry.windowStart >= this.windowMs) {
      entry.failures = 0;
      entry.total = 0;
      entry.windowStart = now;
    }
    entry.total += 1;
    if (failed) entry.failures += 1;

    if (entry.total >= this.minRequests && entry.failures / entry.total >= this.failureRatio) {
      entry.state = 'open';
      entry.openedAt = now;
    }
  }

  private getOrCreate(key: string, now: number): BreakerEntry {
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= CIRCUIT_BREAKER_DEFAULTS.maxEntries) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
      entry = {
        state: 'closed',
        failures: 0,
        total: 0,
        windowStart: now,
        openedAt: 0,
        probeInFlight: false,
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  private reset(entry: BreakerEntry, now: number): void {
    entry.state = 'closed';
    entry.failures = 0;
    entry.total = 0;
    entry.windowStart = now;
    entry.probeInFlight = false;
  }
}
