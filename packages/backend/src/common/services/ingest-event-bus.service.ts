import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable()
export class IngestEventBusService implements OnModuleDestroy {
  private readonly subject = new Subject<string>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DEBOUNCE_MS = 1_000;

  emit(userId: string): void {
    const existing = this.debounceTimers.get(userId);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      userId,
      setTimeout(() => {
        this.debounceTimers.delete(userId);
        this.subject.next(userId);
      }, this.DEBOUNCE_MS),
    );
  }

  forUser(userId: string): Observable<string> {
    return this.subject.asObservable().pipe(
      filter((id) => id === userId),
    );
  }

  all(): Observable<string> {
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
