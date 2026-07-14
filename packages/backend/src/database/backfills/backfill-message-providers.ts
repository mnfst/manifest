/**
 * Post-deploy backfill for `provider_attempts.tenant_provider_id`.
 *
 * The tenant-refactor migrations add the column (+ FK + covering index) but
 * deliberately do NOT stamp pre-upgrade history inline: on a multi-million-row
 * table that held an ACCESS EXCLUSIVE lock on `provider_attempts` for the whole
 * (12–30+ min) backfill, locking the live app out of its main table. This runs
 * that stamping OUT of the boot transaction, in throttled keyset batches.
 *
 * It runs AFTER the full migration batch, so it targets the FINAL schema names:
 * `provider_attempts.tenant_provider_id` (was user_provider_id) matched against
 * `tenant_providers` (was user_providers), whose `created_by_user_id` (was
 * user_id) carries the original user id. Those are pure RENAMEs, so the values
 * are unchanged and the matching is identical to the original in-migration
 * backfill — proven row-for-row against it on a production-data replica.
 *
 * Equivalence: the three passes are the original matching logic, in precedence
 * order, with ONLY a keyset window `am2.id > $1 AND am2.id <= $2` added. Each
 * message's assignment depends only on its own columns and the (static)
 * tenant_providers table, so windowing cannot change any per-row result. Passes
 * run in one short transaction per window; an earlier (more precise) stamp
 * excludes the row from later passes via `am2.tenant_provider_id IS NULL`.
 *
 * Refs: ankane/strong_migrations (backfill in batches), GitLab batched
 * background migrations (batch sizing + throttle), Sequin (keyset cursors).
 */

export const DEFAULT_BACKFILL_OPTIONS = {
  /** Rows per keyset window (one short transaction). */
  batchSize: 10_000,
  /** Pause between windows to spare the primary and read replicas. */
  throttleMs: 50,
  /** Per-window lock wait ceiling — fail fast instead of queueing behind app load. */
  lockTimeoutMs: 5_000,
  /** Per-statement runtime ceiling inside a window. */
  statementTimeoutMs: 60_000,
  /** Retries for a window that hits a transient error (timeout/deadlock/conn). */
  maxRetries: 5,
  /** Base backoff between retries (multiplied by the attempt number). */
  retryBackoffMs: 1_000,
} as const;

// A window rolls back cleanly on failure, so these transient conditions are
// safe to retry: a slow window (autovacuum/IO spike) tripping statement_timeout,
// brief lock contention, a deadlock, or a dropped connection.
const RETRYABLE_ERROR =
  /statement timeout|lock timeout|deadlock|connection terminated|connection closed|ECONNRESET|ETIMEDOUT|server closed the connection/i;

export function isRetryableBackfillError(error: unknown): boolean {
  return RETRYABLE_ERROR.test(error instanceof Error ? error.message : String(error));
}

export interface BackfillTimeouts {
  lockTimeoutMs: number;
  statementTimeoutMs: number;
}

export interface BackfillOptions {
  batchSize?: number;
  throttleMs?: number;
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  logger?: { log: (message: string) => void };
  /** Injectable for tests; defaults to a real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export interface BackfillResult {
  windows: number;
  stamped: number;
}

/**
 * Database operations the backfill needs. Kept narrow so the orchestrator is
 * pure logic over a gateway and unit-testable without a database.
 */
export interface BackfillGateway {
  /**
   * Refresh planner statistics on the tables the stamping passes read. Called
   * once before the first window (see runMessageProviderBackfill).
   */
  analyze(): Promise<void>;
  /**
   * Upper bound (inclusive) of the next keyset window of size `batchSize`
   * containing ids strictly greater than `afterId`, or null when no rows remain.
   */
  nextWindowEnd(afterId: string, batchSize: number): Promise<string | null>;
  /**
   * Run the three stamping passes for ids in `(afterId, endId]` inside one
   * short, timeout-guarded transaction. Returns the number of rows stamped.
   */
  stampWindow(afterId: string, endId: string, timeouts: BackfillTimeouts): Promise<number>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Stamp one window, retrying transient failures (the window rolls back cleanly). */
async function stampWindowWithRetry(
  gateway: BackfillGateway,
  afterId: string,
  endId: string,
  timeouts: BackfillTimeouts,
  maxRetries: number,
  retryBackoffMs: number,
  sleep: (ms: number) => Promise<void>,
  log: (message: string) => void,
): Promise<number> {
  let attempt = 0;
  for (;;) {
    try {
      return await gateway.stampWindow(afterId, endId, timeouts);
    } catch (error) {
      attempt += 1;
      if (attempt > maxRetries || !isRetryableBackfillError(error)) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      log(
        `backfill: window after "${afterId}" failed (attempt ${attempt}/${maxRetries}: ${reason}); retrying`,
      );
      await sleep(retryBackoffMs * attempt);
    }
  }
}

/**
 * Stamp every keyset window in id order. Idempotent and resumable — re-running
 * only re-touches rows still NULL (new messages are already stamped at proxy
 * time), so an interrupted run is safe to restart from the beginning.
 */
export async function runMessageProviderBackfill(
  gateway: BackfillGateway,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const batchSize = options.batchSize ?? DEFAULT_BACKFILL_OPTIONS.batchSize;
  const throttleMs = options.throttleMs ?? DEFAULT_BACKFILL_OPTIONS.throttleMs;
  const timeouts: BackfillTimeouts = {
    lockTimeoutMs: options.lockTimeoutMs ?? DEFAULT_BACKFILL_OPTIONS.lockTimeoutMs,
    statementTimeoutMs: options.statementTimeoutMs ?? DEFAULT_BACKFILL_OPTIONS.statementTimeoutMs,
  };
  const sleep = options.sleep ?? realSleep;
  const maxRetries = options.maxRetries ?? DEFAULT_BACKFILL_OPTIONS.maxRetries;
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_BACKFILL_OPTIONS.retryBackoffMs;
  const log = (message: string): void => options.logger?.log(message);

  // Refresh planner statistics before the first window. The migration just
  // added tenant_provider_id (≈100% NULL) and autovacuum's analyze has not run
  // yet, so the planner mis-estimates `tenant_provider_id IS NULL` as highly
  // selective and builds a full-table bitmap on it every window — turning a
  // sub-second keyset window into a statement_timeout. ANALYZE lets it cost the
  // NULL filter correctly and drive each window off the PK id-range instead.
  await gateway.analyze();

  let afterId = '';
  let windows = 0;
  let stamped = 0;

  for (;;) {
    const endId = await gateway.nextWindowEnd(afterId, batchSize);
    if (endId === null) {
      break;
    }
    stamped += await stampWindowWithRetry(
      gateway,
      afterId,
      endId,
      timeouts,
      maxRetries,
      retryBackoffMs,
      sleep,
      log,
    );
    windows += 1;
    afterId = endId;
    if (windows % 25 === 0) {
      log(`backfill: ${windows} window(s) processed, ${stamped} message(s) stamped so far`);
    }
    if (throttleMs > 0) {
      await sleep(throttleMs);
    }
  }

  log(`backfill: done — stamped ${stamped} message(s) across ${windows} window(s)`);
  return { windows, stamped };
}
