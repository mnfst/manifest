import { Injectable, OnModuleDestroy, HttpException, HttpStatus } from '@nestjs/common';
import { formatManifestError } from '../../common/errors/error-codes';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 200;
const IP_RATE_MAX_REQUESTS = 500;
const MAX_RATE_ENTRIES = 50_000;
const CONCURRENCY_MAX = 10;
const CLEANUP_INTERVAL_MS = 60_000;

interface RateEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class ProxyRateLimiter implements OnModuleDestroy {
  private readonly rates = new Map<string, RateEntry>();
  private readonly ipRates = new Map<string, RateEntry>();
  private readonly concurrency = new Map<string, number>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictExpired(), CLEANUP_INTERVAL_MS);
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  /**
   * Check if the user is over the rate limit and increment the counter.
   * All requests count toward the limit (both successful and failed).
   */
  checkLimit(userId: string): void {
    const now = Date.now();
    let entry = this.rates.get(userId);

    if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
      entry = { count: 0, windowStart: now };
    }

    if (entry.count >= RATE_MAX_REQUESTS) {
      throw new HttpException(formatManifestError('M201'), HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.count++;
    // LRU touch: delete-then-set re-inserts at tail of insertion order so
    // evictLruIfNeeded() drops genuinely-stale entries instead of arbitrary
    // long-lived ones during overflow.
    this.rates.delete(userId);
    this.rates.set(userId, entry);
    this.evictLruIfNeeded();
  }

  /**
   * Check if the IP is over the per-IP rate limit and increment the counter.
   * This catches abuse even when many requests share a single userId (e.g. dev).
   */
  checkIpLimit(ip: string): void {
    const now = Date.now();
    let entry = this.ipRates.get(ip);

    if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
      entry = { count: 0, windowStart: now };
    }

    if (entry.count >= IP_RATE_MAX_REQUESTS) {
      throw new HttpException(formatManifestError('M202'), HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.count++;
    // LRU touch — see checkLimit().
    this.ipRates.delete(ip);
    this.ipRates.set(ip, entry);
    this.evictIpLruIfNeeded();
  }

  acquireSlot(userId: string): void {
    const current = this.concurrency.get(userId) ?? 0;
    if (current >= CONCURRENCY_MAX) {
      throw new HttpException(formatManifestError('M203'), HttpStatus.TOO_MANY_REQUESTS);
    }
    this.concurrency.set(userId, current + 1);
  }

  releaseSlot(userId: string): void {
    const current = this.concurrency.get(userId) ?? 0;
    if (current <= 1) {
      this.concurrency.delete(userId);
    } else {
      this.concurrency.set(userId, current - 1);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.rates) {
      if (now - entry.windowStart >= RATE_WINDOW_MS) {
        this.rates.delete(key);
      }
    }
    for (const [key, entry] of this.ipRates) {
      if (now - entry.windowStart >= RATE_WINDOW_MS) {
        this.ipRates.delete(key);
      }
    }
  }

  private evictLruIfNeeded(): void {
    while (this.rates.size > MAX_RATE_ENTRIES) {
      const oldest = this.rates.keys().next().value as string;
      this.rates.delete(oldest);
    }
  }

  private evictIpLruIfNeeded(): void {
    while (this.ipRates.size > MAX_RATE_ENTRIES) {
      const oldest = this.ipRates.keys().next().value as string;
      this.ipRates.delete(oldest);
    }
  }
}
