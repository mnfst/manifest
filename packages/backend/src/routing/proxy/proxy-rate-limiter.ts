import {
  Injectable,
  OnModuleDestroy,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
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

  checkLimit(userId: string): void {
    const now = Date.now();
    let entry = this.rates.get(userId);

    if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
      entry = { count: 0, windowStart: now };
    }

    entry.count++;
    if (entry.count > RATE_MAX_REQUESTS) {
      this.rates.set(userId, entry);
      throw new HttpException(
        'Rate limit exceeded. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.rates.set(userId, entry);
    this.evictLruIfNeeded();
  }

  acquireSlot(userId: string): void {
    const current = this.concurrency.get(userId) ?? 0;
    if (current >= CONCURRENCY_MAX) {
      throw new HttpException(
        'Too many concurrent requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
  }

  private evictLruIfNeeded(): void {
    while (this.rates.size > MAX_RATE_ENTRIES) {
      const oldest = this.rates.keys().next().value as string;
      this.rates.delete(oldest);
    }
  }
}
