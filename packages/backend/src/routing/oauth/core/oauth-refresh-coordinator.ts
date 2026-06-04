/**
 * Single-flight coordinator for lazy OAuth access-token refreshes.
 *
 * Why this exists (issue #2012): providers like OpenAI now issue ROTATING
 * refresh tokens — every successful refresh invalidates the old refresh token
 * and returns a new one. The naive "parse blob → refresh(blob.r) → persist"
 * path each `unwrapToken()` used has two fatal races under that model:
 *
 *   1. Concurrent requests. An agent fires many parallel requests against an
 *      expired token. Each one parsed its own (stale) blob and calls the
 *      provider with the SAME old refresh token. The first rotates it; every
 *      other one gets `refresh_token_invalidated` and fails. A request that
 *      arrives just after a refresh finishes can still hold the pre-refresh
 *      blob (read from the routing cache) and refresh again with the now-dead
 *      token.
 *
 *   2. Persist-after-rotate failure. If the DB write fails AFTER the provider
 *      already rotated, the only copy of the new refresh token is lost while
 *      the stored one is already dead — the account is bricked until the user
 *      deletes and recreates it (exactly issue #2012).
 *
 * This coordinator fixes both for a single backend instance (the current
 * deployment shape) without a distributed lock:
 *
 *   - Concurrent refreshes for the SAME credential coalesce onto one in-flight
 *     promise, keyed by provider+user+agent+label. Different credentials never
 *     block each other.
 *   - Before refreshing, it re-reads the freshest persisted blob straight from
 *     the DB (bypassing the routing cache). If another request already
 *     refreshed it, the fresh blob is returned and the redundant rotation is
 *     skipped. The fresh refresh token — not the caller's stale one — is the
 *     refresh source.
 *   - The refreshed blob is persisted with a few retries. The provider has
 *     already rotated, so we NEVER refresh again on a persist failure (that
 *     would just reuse the dead token); we retry persisting the same blob.
 *
 * Multi-replica correctness (two backend instances refreshing the same
 * credential at the same instant) is intentionally out of scope here — it
 * needs an optimistic compare-and-set on persist or a DB lease, tracked as a
 * follow-up. The pending-OAuth store is already documented as single-instance.
 */
import { Logger } from '@nestjs/common';

/** Minimum shape every provider's stored OAuth blob shares. */
export interface RefreshableBlob {
  /** Access token. */
  t: string;
  /** Access-token expiry (epoch ms). */
  e: number;
}

/** Skew applied to expiry so a token about to expire is refreshed early. */
export const REFRESH_EXPIRY_SKEW_MS = 60_000;

/** How many times to retry persisting an already-rotated blob before giving up. */
export const PERSIST_MAX_ATTEMPTS = 3;

export interface CoordinatedRefreshParams<T extends RefreshableBlob> {
  /** Identity key for single-flight: `${provider}:${userId}:${agentId}:${label}`. */
  readonly key: string;
  readonly logger: Logger;
  /**
   * Blob the caller already parsed from the value it was handed. May be stale
   * (read before a concurrent refresh) — used only as a fallback when the
   * fresh DB read returns nothing.
   */
  readonly callerBlob: T;
  /** Fresh, cache-bypassing read of the persisted raw credential value. */
  readonly readFreshRaw: () => Promise<string | null>;
  /** Parse a raw stored value into the provider's blob type. */
  readonly parse: (raw: string) => T | null;
  /** Perform the provider-specific refresh-token exchange. */
  readonly refresh: (current: T) => Promise<T>;
  /** Persist the refreshed blob (serialize + upsert). */
  readonly persist: (refreshed: T) => Promise<void>;
}

/**
 * Build the single-flight key for one credential. Namespaced by provider so two
 * providers never share an entry, and by label so an agent's multiple keys for
 * the same provider refresh independently. `undefined`/`'Default'` labels map to
 * the same key, matching how the row is persisted.
 */
export function oauthRefreshKey(
  providerId: string,
  userId: string,
  agentId: string,
  label?: string,
): string {
  return `${providerId}:${userId}:${agentId}:${label ?? 'Default'}`;
}

// Shared across every OAuth service. Each value is the in-flight refresh for
// one credential; the key namespaces by provider so collisions are impossible.
const inFlight = new Map<string, Promise<RefreshableBlob>>();

/**
 * Refresh (or reuse a concurrently-refreshed) OAuth blob for one credential,
 * guaranteeing at most one provider round-trip in flight per credential.
 *
 * Resolves to the usable blob (freshly refreshed, or the already-valid blob
 * found in the DB). Rejects if the provider refresh fails or the blob cannot
 * be persisted after retries — callers keep their provider-specific fallback
 * behaviour in a `catch`.
 */
export async function coordinateOAuthRefresh<T extends RefreshableBlob>(
  params: CoordinatedRefreshParams<T>,
): Promise<T> {
  const pending = inFlight.get(params.key) as Promise<T> | undefined;
  if (pending) return pending;

  const run = refreshOnce(params);
  inFlight.set(params.key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(params.key);
  }
}

async function refreshOnce<T extends RefreshableBlob>(
  params: CoordinatedRefreshParams<T>,
): Promise<T> {
  // The DB is the source of truth: a parallel request (or a previous one that
  // resolved just before this caller read its cached copy) may have already
  // rotated the token. Re-read it so we never refresh with a stale token.
  let current = params.callerBlob;
  const freshRaw = await params.readFreshRaw();
  if (freshRaw) {
    const fresh = params.parse(freshRaw);
    if (fresh) current = fresh;
  }

  // Already valid — either it never really expired, or someone just refreshed.
  if (Date.now() < current.e - REFRESH_EXPIRY_SKEW_MS) return current;

  const refreshed = await params.refresh(current);
  await persistWithRetry(params, refreshed);
  return refreshed;
}

async function persistWithRetry<T extends RefreshableBlob>(
  params: CoordinatedRefreshParams<T>,
  refreshed: T,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= PERSIST_MAX_ATTEMPTS; attempt++) {
    try {
      await params.persist(refreshed);
      return;
    } catch (err) {
      lastErr = err;
      params.logger.warn(
        `OAuth token persist attempt ${attempt}/${PERSIST_MAX_ATTEMPTS} failed for ${params.key}: ${err}`,
      );
    }
  }
  // Surface the failure so the caller's catch runs, but the rotated token is
  // gone either way — this is the brick window we cannot fully close without a
  // distributed lease. Retrying the same blob is the best we can do.
  throw lastErr;
}

/** Test seam: clear in-flight state between cases. */
export function __resetOAuthRefreshCoordinator(): void {
  inFlight.clear();
}
