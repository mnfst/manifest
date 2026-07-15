import { DEFAULT_BACKFILL_OPTIONS, isRetryableBackfillError } from './backfill-message-providers';

export interface RequestBackfillTimeouts {
  lockTimeoutMs: number;
  statementTimeoutMs: number;
}

export interface RequestBackfillGateway {
  analyze(): Promise<void>;
  backfillFallbackGroups(
    timeouts: RequestBackfillTimeouts,
  ): Promise<{ requests: number; attempts: number }>;
  nextWindowEnd(afterId: string, batchSize: number): Promise<string | null>;
  backfillWindow(
    afterId: string,
    endId: string,
    timeouts: RequestBackfillTimeouts,
  ): Promise<{ requests: number; attempts: number; rejections: number }>;
  finalize(timeouts: RequestBackfillTimeouts): Promise<void>;
}

export interface RequestBackfillOptions {
  batchSize?: number;
  throttleMs?: number;
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  logger?: { log: (message: string) => void };
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestBackfillResult {
  windows: number;
  requests: number;
  attempts: number;
  rejections: number;
}

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`request backfill ${name} must be a positive finite number`);
  }
}

function assertNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`request backfill ${name} must be a non-negative finite number`);
  }
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Regroup history after startup in short, retryable keyset windows. This is
 * deliberately not a TypeORM migration: deploy readiness must not wait for a
 * scan and rewrite of the hot provider_attempts table.
 */
export async function runRequestBackfill(
  gateway: RequestBackfillGateway,
  options: RequestBackfillOptions = {},
): Promise<RequestBackfillResult> {
  const batchSize = options.batchSize ?? DEFAULT_BACKFILL_OPTIONS.batchSize;
  const throttleMs = options.throttleMs ?? DEFAULT_BACKFILL_OPTIONS.throttleMs;
  const maxRetries = options.maxRetries ?? DEFAULT_BACKFILL_OPTIONS.maxRetries;
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_BACKFILL_OPTIONS.retryBackoffMs;
  const sleep = options.sleep ?? realSleep;
  const log = (message: string): void => options.logger?.log(message);
  const timeouts: RequestBackfillTimeouts = {
    lockTimeoutMs: options.lockTimeoutMs ?? DEFAULT_BACKFILL_OPTIONS.lockTimeoutMs,
    statementTimeoutMs: options.statementTimeoutMs ?? DEFAULT_BACKFILL_OPTIONS.statementTimeoutMs,
  };

  assertPositiveFinite('batchSize', batchSize);
  assertNonNegativeFinite('throttleMs', throttleMs);
  assertNonNegativeFinite('maxRetries', maxRetries);
  assertNonNegativeFinite('retryBackoffMs', retryBackoffMs);
  assertPositiveFinite('lockTimeoutMs', timeouts.lockTimeoutMs);
  assertPositiveFinite('statementTimeoutMs', timeouts.statementTimeoutMs);

  await gateway.analyze();

  let afterId = '';
  const result: RequestBackfillResult = {
    windows: 0,
    requests: 0,
    attempts: 0,
    rejections: 0,
  };

  let fallbackAttempt = 0;
  for (;;) {
    try {
      const grouped = await gateway.backfillFallbackGroups(timeouts);
      result.requests += grouped.requests;
      result.attempts += grouped.attempts;
      if (grouped.attempts > 0) {
        log(
          `request backfill: reconstructed ${grouped.requests} legacy fallback request(s) from ${grouped.attempts} attempt(s)`,
        );
      }
      break;
    } catch (error) {
      fallbackAttempt += 1;
      if (fallbackAttempt > maxRetries || !isRetryableBackfillError(error)) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      log(
        `request backfill: fallback regrouping failed (attempt ${fallbackAttempt}/${maxRetries}: ${reason}); retrying`,
      );
      await sleep(retryBackoffMs * fallbackAttempt);
    }
  }

  for (;;) {
    const endId = await gateway.nextWindowEnd(afterId, batchSize);
    if (endId === null) break;

    let attempt = 0;
    for (;;) {
      try {
        const window = await gateway.backfillWindow(afterId, endId, timeouts);
        result.requests += window.requests;
        result.attempts += window.attempts;
        result.rejections += window.rejections;
        break;
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries || !isRetryableBackfillError(error)) throw error;
        const reason = error instanceof Error ? error.message : String(error);
        log(
          `request backfill: window after "${afterId}" failed (attempt ${attempt}/${maxRetries}: ${reason}); retrying`,
        );
        await sleep(retryBackoffMs * attempt);
      }
    }

    result.windows += 1;
    afterId = endId;
    if (result.windows % 25 === 0) {
      log(
        `request backfill: ${result.windows} window(s), ${result.attempts} attempt(s), ${result.rejections} zero-attempt rejection(s)`,
      );
    }
    if (throttleMs > 0) await sleep(throttleMs);
  }

  let finalizeAttempt = 0;
  for (;;) {
    try {
      await gateway.finalize(timeouts);
      break;
    } catch (error) {
      finalizeAttempt += 1;
      if (finalizeAttempt > maxRetries || !isRetryableBackfillError(error)) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      log(
        `request backfill: finalization failed (attempt ${finalizeAttempt}/${maxRetries}: ${reason}); retrying`,
      );
      await sleep(retryBackoffMs * finalizeAttempt);
    }
  }
  log(
    `request backfill: done — ${result.attempts} attempt(s) and ${result.rejections} rejection(s) across ${result.windows} window(s)`,
  );
  return result;
}
