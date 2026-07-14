import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutofixService } from './autofix.service';
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
 * Ceiling on consent checks awaiting a verdict. Each one retains a request body,
 * and {@link MAX_QUEUE} only bounds what has already cleared the gate — so a slow
 * gate (a cache miss storm against a struggling DB) would otherwise let bodies
 * pile up behind it, unbounded. The gate is cached per tenant and per agent, so
 * in steady state almost nothing is ever in flight.
 */
const MAX_IN_FLIGHT_GATES = 100;

/**
 * Streams an agent's request-side 4xx to Phoenix as observations, carrying the
 * full request body.
 *
 * Auto-fix itself only reports the requests it actually heals: the narrow
 * `AUTOFIX_REPAIRABLE_STATUSES` set, the primary attempt only, and only when the
 * heal call gets through. Everything else reached Phoenix solely through
 * Peacock's hourly scrape of `provider_attempts`, which stores the model-parameter
 * snapshot and not the messages — so those issues arrived without the body that
 * caused them. This reporter closes that gap without persisting a single byte in
 * Manifest: the body is scrubbed, batched, and POSTed to Phoenix, which is where
 * request evidence already lives.
 *
 * **Only for agents with Auto-fix on** ({@link AutofixService.isActiveFor}).
 * Turning Auto-fix on is what agrees to send failing requests to the healing
 * service; an agent that never did must not have its callers' prompt content
 * shipped there. The gate is checked per report and fails closed.
 *
 * Wholly best-effort. Nothing here is awaited by the request path, no failure
 * propagates, and the queue is bounded — a Phoenix outage costs dropped
 * evidence, never a slow or failed proxy response.
 *
 * Off unless `AUTOFIX_REPORT_ALL_4XX=true`, a second, deployment-level switch on
 * top of the per-agent gate.
 */
@Injectable()
export class ObservationReporter implements OnModuleDestroy {
  private readonly logger = new Logger(ObservationReporter.name);
  private readonly enabled: boolean;
  private queue: HealRequest[] = [];
  /** Consent checks that have not resolved yet — awaited on shutdown, capped on entry. */
  private readonly inFlight = new Set<Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private dropped = 0;

  constructor(
    @Inject(HEALING_CLIENT) private readonly client: HealingClient,
    private readonly autofix: AutofixService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('AUTOFIX_REPORT_ALL_4XX')?.trim() === 'true';
    this.logger.log(`config: enabled=${this.enabled}`);
  }

  /**
   * Queue a failed forward for reporting, if the agent has Auto-fix on.
   * Synchronous and non-throwing by contract — the caller is on the request path
   * and must never wait on, or fail because of, evidence collection. The consent
   * gate is async (cached, an occasional DB read), so it runs detached.
   */
  report(input: ObservationInput): void {
    if (!this.enabled) return;
    if (this.inFlight.size >= MAX_IN_FLIGHT_GATES) {
      this.countDrop();
      return;
    }
    const pending: Promise<void> = this.gateAndEnqueue(input).finally(() => {
      this.inFlight.delete(pending);
    });
    this.inFlight.add(pending);
  }

  /** Note a dropped observation, logging once per 100 so a saturated feed can't flood. */
  private countDrop(): void {
    this.dropped += 1;
    // Enough to see sustained backpressure in the logs without a failing Phoenix
    // (or a slow gate) turning into a log flood of its own.
    if (this.dropped % 100 === 0) {
      this.logger.warn(`observation feed saturated — dropped ${this.dropped} so far`);
    }
  }

  private async gateAndEnqueue(input: ObservationInput): Promise<void> {
    try {
      // Build first: a body we can't scrub or a status we don't report costs
      // nothing to reject, and skips the gate's DB read entirely.
      const observation = toObservation(input);
      if (!observation) return;
      if (!(await this.autofix.isActiveFor(input.tenantId, input.agentId))) return;
      this.enqueue(observation);
    } catch (err) {
      // Includes a gate that threw (DB hiccup): no consent proven, no body sent.
      this.logger.warn(`observation dropped: ${(err as Error).message}`);
    }
  }

  private enqueue(observation: HealRequest): void {
    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift();
      this.countDrop();
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
   * Settle the outstanding consent checks first, or the observations still inside
   * one would never reach the queue we are about to drain.
   *
   * No timer to clear afterwards: one is only ever scheduled while the queue is
   * non-empty, and `flush()` clears it on entry — so an empty queue implies none.
   */
  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
    while (this.queue.length > 0) await this.flush();
  }
}
