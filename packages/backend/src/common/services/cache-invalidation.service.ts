import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Subscription } from 'rxjs';
import { IngestEventBusService } from './ingest-event-bus.service';

const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class CacheInvalidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly trackedKeys = new Map<string, Set<string>>();
  private subscription?: Subscription;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly eventBus: IngestEventBusService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.eventBus.all().subscribe((userId) => {
      void this.invalidateForUser(userId);
    });
    this.cleanupTimer = setInterval(() => this.trackedKeys.clear(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  trackKey(userId: string, cacheKey: string): void {
    let keys = this.trackedKeys.get(userId);
    if (!keys) {
      keys = new Set();
      this.trackedKeys.set(userId, keys);
    }
    keys.add(cacheKey);
  }

  private async invalidateForUser(userId: string): Promise<void> {
    const keys = this.trackedKeys.get(userId);
    if (!keys || keys.size === 0) return;

    const keysArray = [...keys];
    this.trackedKeys.delete(userId);
    await Promise.all(keysArray.map((k) => this.cacheManager.del(k)));
    this.logger.debug(`Invalidated ${keysArray.length} cache entries for user ${userId}`);
  }
}
