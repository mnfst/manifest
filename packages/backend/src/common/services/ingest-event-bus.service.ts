import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export type IngestEventKind = 'message' | 'agent' | 'routing';

export interface IngestEvent {
  userId: string;
  kind: IngestEventKind;
}

@Injectable()
export class IngestEventBusService implements OnModuleDestroy {
  private readonly subject = new Subject<IngestEvent>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DEBOUNCE_MS = 250;

  /**
   * Notify subscribers that the given user's data changed. The kind narrows
   * which dashboard surfaces should refetch — message-feed pages can ignore
   * routing config updates and vice-versa, avoiding the previous "any change
   * refetches every open page" cascade.
   */
  emit(userId: string, kind: IngestEventKind = 'message'): void {
    const debounceKey = `${userId}:${kind}`;
    const existing = this.debounceTimers.get(debounceKey);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      debounceKey,
      setTimeout(() => {
        this.debounceTimers.delete(debounceKey);
        this.subject.next({ userId, kind });
      }, this.DEBOUNCE_MS),
    );
  }

  forUser(userId: string): Observable<IngestEvent> {
    return this.subject.asObservable().pipe(filter((e) => e.userId === userId));
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
