import { createHash } from 'crypto';

import { Injectable } from '@nestjs/common';

const TURN_STATE_TTL_MS = 5 * 60 * 1000; // matches the OpenAI prompt-cache idle window
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_ENTRIES = 10_000;

interface CachedTurnState {
  token: string;
  expiresAt: number;
}

export interface CodexAffinityRequest {
  /** Headers to merge into the upstream request. */
  headers: Record<string, string>;
  /** Key under which `capture()` stores the response's turn-state token. */
  storeKey: string;
}

/**
 * Prompt-cache affinity for the ChatGPT subscription backend
 * (`chatgpt.com/backend-api/codex/responses`).
 *
 * The Codex backend only serves prompt-cache hits when consecutive requests
 * land on the same shard. The real Codex CLI achieves that by (1) sending
 * stable `session-id` / `thread-id` headers, (2) defaulting the body's
 * `prompt_cache_key` to its thread id, and (3) replaying the
 * `x-codex-turn-state` sticky-routing token returned by each response on the
 * next request. Manifest sent none of these, so every request landed on an
 * arbitrary shard and `cached_tokens` was always 0 — agentic tool loops
 * re-paid their full prompt prefix on every step (mnfst/manifest#2217).
 *
 * This service closes that gap:
 * - `prepare()` derives deterministic session/thread ids from the
 *   subscription token + the caller's `prompt_cache_key` (injecting a stable
 *   per-token default when the caller sent none, exactly like the CLI), and
 *   attaches the last seen turn-state token if one is cached.
 * - `capture()` stores the response's turn-state token for the next request,
 *   and drops it on upstream errors so a poisoned token can't wedge a session.
 *
 * Turn-state is cached in-memory with a sliding TTL. The CLI scopes the token
 * to a single turn, but a proxy cannot see turn boundaries; the TTL matches
 * the prompt-cache idle window, so the token only outlives a turn while the
 * cache it routes to is still warm. Tokens are per-instance — in a
 * multi-replica deployment each replica converges on its own affinity, which
 * degrades to today's behavior at worst.
 */
@Injectable()
export class CodexSessionAffinity {
  private readonly turnStates = new Map<string, CachedTurnState>();
  private lastCleanup = Date.now();

  /**
   * Derive affinity headers for an outgoing Codex-backend request and inject
   * a stable `prompt_cache_key` into `requestBody` when the caller sent none.
   */
  prepare(apiKey: string, requestBody: Record<string, unknown>): CodexAffinityRequest {
    const callerKey = requestBody.prompt_cache_key;
    const cacheKey =
      typeof callerKey === 'string' && callerKey
        ? callerKey
        : deriveStableId('prompt-cache-key', apiKey);
    requestBody.prompt_cache_key = cacheKey;

    const storeKey = sha256(`${apiKey}\u0000${cacheKey}`);
    const headers: Record<string, string> = {
      'session-id': deriveStableId('session-id', apiKey, cacheKey),
      'thread-id': deriveStableId('thread-id', apiKey, cacheKey),
    };
    const turnState = this.retrieve(storeKey);
    if (turnState) headers['x-codex-turn-state'] = turnState;

    return { headers, storeKey };
  }

  /**
   * Store the response's sticky-routing token for the next request in this
   * session, or evict the cached one when the upstream rejected the request.
   */
  capture(storeKey: string, response: Response): void {
    if (!response.ok) {
      this.turnStates.delete(storeKey);
      return;
    }
    const token = response.headers.get('x-codex-turn-state');
    if (!token) return;
    this.maybeCleanup();
    if (this.turnStates.size >= MAX_ENTRIES && !this.turnStates.has(storeKey)) {
      const oldest = this.turnStates.keys().next().value as string;
      this.turnStates.delete(oldest);
    }
    // Delete-then-set keeps Map insertion order ≈ recency for the eviction above.
    this.turnStates.delete(storeKey);
    this.turnStates.set(storeKey, { token, expiresAt: Date.now() + TURN_STATE_TTL_MS });
  }

  private retrieve(storeKey: string): string | null {
    const entry = this.turnStates.get(storeKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.turnStates.delete(storeKey);
      return null;
    }
    // Sliding expiry: an active tool loop keeps its affinity alive.
    entry.expiresAt = Date.now() + TURN_STATE_TTL_MS;
    return entry.token;
  }

  /** Lazily evict expired entries to avoid unbounded growth. */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [key, entry] of this.turnStates) {
      if (now > entry.expiresAt) this.turnStates.delete(key);
    }
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Deterministic UUID-shaped id from a purpose + the inputs that scope it.
 * The Codex backend expects UUID-formatted session/thread ids; hashing keeps
 * them stable across requests (and across restarts) without storing state.
 */
function deriveStableId(purpose: string, ...parts: string[]): string {
  const digest = createHash('sha256')
    .update(`manifest-codex-affinity:${purpose}:${parts.join('\u0000')}`)
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
