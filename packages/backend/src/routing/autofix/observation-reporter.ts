import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HEALING_CLIENT, type HealingClient } from './healing-client';
import { toObservation, type ObservationInput } from './observation-payload';
import type { HealRequest } from './phoenix.types';

/** Phoenix's `/api/heal/observe` accepts at most 200 observations per call. */
const BATCH_MAX = 50;
const FLUSH_INTERVAL_MS = 2_000;
/**
 * Backpressure ceiling. A provider outage can turn every request into a 4xx, and
 * a queue that grows with traffic would trade a Phoenix outage for a Manifest
 * one. Past this depth the oldest observations are dropped: evidence is
 * sampled-by-nature (Phoenix folds recurrences into one issue), so losing some
 * is strictly better than holding the heap.
 */
const MAX_QUEUE = 500;

/**
 * Streams every request-side 4xx to Phoenix as an observation, carrying the full
 * request body — independent of Auto-fix.
 *
 * Auto-fix only talks to Phoenix for tenants it is allowed to heal, and only for
 * the narrow `AUTOFIX_REPAIRABLE_STATUSES` set. Everything else reached Phoenix
 * solely through Peacock's hourly scrape of `agent_messages`, which stores the
 * model-parameter snapshot and not the messages — so those issues arrived
 * without the body that caused them. This reporter closes that gap without
 * persisting a single byte in Manifest: the body is scrubbed, batched, and
 * POSTed to Phoenix, which is where request evidence already lives.
 *
 * Wholly best-effort. Nothing here is awaited by the request path, no failure
 * propagates, and the queue is bounded — a Phoenix outage costs dropped
 * evidence, never a slow or failed proxy response.
 *
 * Off unless `AUTOFIX_REPORT_ALL_4XX=true`: it ships caller prompt content to
 * the healing service, which is a deployment decision, not a default.
 */
@Injectable()
export class ObservationReporter implements OnModuleDestroy {
  private readonly logger = new Logger(ObservationReporter.name);
  private readonly enabled: boolean;
  private queue: HealRequest[] = [];
  private timer: NodeJS.Timeout | null = null;
  private dropped = 0;

  constructor(
    @Inject(HEALING_CLIENT) private readonly client: HealingClient,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('AUTOFIX_REPORT_ALL_4XX')?.trim() === 'true';
    this.logger.log(`config: enabled=${this.enabled}`);
  }

  /**
   * Queue a failed forward for reporting. Synchronous and non-throwing by
   * contract — the caller is on the request path and must never wait on, or fail
   * because of, evidence collection.
   */
  report(input: ObservationInput): void {
    if (!this.enabled) return;
    try {
      const observation = toObservation(input);
      if (!observation) return;
      this.enqueue(observation);
    } catch (err) {
      this.logger.warn(`observation dropped: ${(err as Error).message}`);
    }
  }

  private enqueue(observation: HealRequest): void {
    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift();
      this.dropped += 1;
      // One line per 100 drops: enough to see sustained backpressure in the logs
      // without a failing Phoenix turning into a log flood of its own.
      if (this.dropped % 100 === 0) {
        this.logger.warn(`observation queue full — dropped ${this.dropped} so far`);
      }
    }
    this.queue.push(observation);
    if (this.queue.length >= BATCH_MAX) {
      void this.flush();
      return;
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    // Never hold the event loop open on a pending batch.
    this.timer.unref?.();
  }

  /** Drain one batch to Phoenix. Swallows every failure; the batch is lost, not retried. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    const batch = this.queue.slice(0, BATCH_MAX);
    this.queue = this.queue.slice(batch.length);
    try {
      await this.client.observe(batch);
    } catch (err) {
      this.logger.warn(`observe batch of ${batch.length} failed: ${(err as Error).message}`);
    }
    if (this.queue.length > 0) this.scheduleFlush();
  }

  /**
   * Drain everything on shutdown, not just one batch. `flush()` sends at most
   * BATCH_MAX and reschedules the rest on a timer that will never fire once the
   * process is going down. It always removes the batch it took (a failed batch is
   * dropped, not retried), so the queue strictly shrinks and this terminates.
   *
   * No timer to clear afterwards: one is only ever scheduled while the queue is
   * non-empty, and `flush()` clears it on entry — so an empty queue implies none.
   */
  async onModuleDestroy(): Promise<void> {
    while (this.queue.length > 0) await this.flush();
  }
}
