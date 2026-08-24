import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { agentListCacheKey } from '../constants/cache.constants';

export type IngestEventKind = 'message' | 'agent' | 'routing';

export interface IngestEvent {
  tenantId: string;
  kind: IngestEventKind;
  /** Optional attribution: which user triggered the change. Never used for scoping. */
  userId?: string | null;
}

@Injectable()
export class IngestEventBusService implements OnModuleDestroy {
  private readonly subject = new Subject<IngestEvent>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DEBOUNCE_MS = 250;

  constructor(
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {}

  private async publish(event: IngestEvent): Promise<void> {
    if (event.kind === 'message' && this.cacheManager) {
      // Agent-list responses include message_count. Clear both variants before
      // subscribers refetch so the next response cannot reuse a stale count.
      await Promise.allSettled([
        this.cacheManager.del(agentListCacheKey(event.tenantId, false)),
        this.cacheManager.del(agentListCacheKey(event.tenantId, true)),
      ]);
    }
    this.subject.next(event);
  }

  /**
   * Notify subscribers that the given tenant's data changed. The kind narrows
   * which dashboard surfaces should refetch — message-feed pages can ignore
   * routing config updates and vice-versa, avoiding the previous "any change
   * refetches every open page" cascade.
   */
  emit(tenantId: string, kind: IngestEventKind = 'message', userId?: string | null): void {
    const debounceKey = `${tenantId}:${kind}`;
    const existing = this.debounceTimers.get(debounceKey);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      debounceKey,
      setTimeout(() => {
        this.debounceTimers.delete(debounceKey);
        void this.publish({ tenantId, kind, userId });
      }, this.DEBOUNCE_MS),
    );
  }

  /** Null tenantId (fresh account, no tenant yet) matches no events. */
  forTenant(tenantId: string | null): Observable<IngestEvent> {
    return this.subject.asObservable().pipe(filter((e) => e.tenantId === tenantId));
  }

  all(): Observable<IngestEvent> {
    return this.subject.asObservable();
  }

  onModuleDestroy(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.subject.complete();
  }
}
