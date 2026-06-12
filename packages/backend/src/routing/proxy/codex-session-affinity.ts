import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

const SESSION_TTL_MS = 5 * 60 * 1000; // matches the OpenAI prompt-cache idle window
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_ENTRIES = 10_000;
// Legitimate prompt_cache_key values are short identifiers; an over-long one is
// treated as absent so a caller can't amplify memory by storing huge unique
// keys (MAX_ENTRIES bounds the count, this bounds each key's size).
const MAX_CACHE_KEY_LEN = 512;

interface CodexSession {
  sessionId: string;
  threadId: string;
  promptCacheKey: string;
  turnState?: string;
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
 * - `prepare()` resolves a session for the subscription token + the caller's
 *   `prompt_cache_key` (injecting a stable default when the caller sent none,
 *   exactly like the CLI) and attaches its ids plus the last seen turn-state
 *   token.
 * - `capture()` stores the response's turn-state token for the next request,
 *   and drops it on upstream errors so a poisoned token can't wedge a session.
 *
 * Session ids are random, never derived from the credential — the token is
 * only used as an in-memory map key and never flows into any hash or header.
 * Sessions live in-memory with a sliding TTL: ids only need to outlive the
 * upstream prompt cache they pin (minutes), so losing them on restart or
 * expiry just means one cold-cache request, which is today's behavior on
 * every request. The CLI scopes turn-state to a single turn, but a proxy
 * cannot see turn boundaries; the TTL bounds how far a token can outlive its
 * turn to the window where the cache it routes to is still warm. Tokens are
 * per-instance — in a multi-replica deployment each replica converges on its
 * own affinity, which degrades to today's behavior at worst.
 */
@Injectable()
export class CodexSessionAffinity {
  private readonly sessions = new Map<string, CodexSession>();
  private lastCleanup = Date.now();

  /**
   * Resolve affinity headers for an outgoing Codex-backend request and inject
   * a stable `prompt_cache_key` into `requestBody` when the caller sent none.
   */
  prepare(apiKey: string, requestBody: Record<string, unknown>): CodexAffinityRequest {
    const callerKey = requestBody.prompt_cache_key;
    const cacheKey =
      typeof callerKey === 'string' && callerKey && callerKey.length <= MAX_CACHE_KEY_LEN
        ? callerKey
        : null;
    const storeKey = cacheKey ? `${apiKey}\u0000${cacheKey}` : apiKey;

    const session = this.getOrCreateSession(storeKey, cacheKey);
    requestBody.prompt_cache_key = session.promptCacheKey;

    const headers: Record<string, string> = {
      'session-id': session.sessionId,
      'thread-id': session.threadId,
    };
    if (session.turnState) headers['x-codex-turn-state'] = session.turnState;

    return { headers, storeKey };
  }

  /**
   * Store the response's sticky-routing token for the next request in this
   * session, or evict the stale one when the upstream rejected the request.
   */
  capture(storeKey: string, response: Response): void {
    const session = this.sessions.get(storeKey);
    // The session can be gone when a request outlives the TTL; the next
    // prepare() starts a fresh one, so there is nothing to record here.
    if (!session) return;
    if (!response.ok) {
      delete session.turnState;
      return;
    }
    const token = response.headers.get('x-codex-turn-state');
    if (!token) return;
    session.turnState = token;
    session.expiresAt = Date.now() + SESSION_TTL_MS;
  }

  private getOrCreateSession(storeKey: string, callerCacheKey: string | null): CodexSession {
    this.maybeCleanup();
    const existing = this.sessions.get(storeKey);
    if (existing && Date.now() <= existing.expiresAt) {
      // Sliding expiry: an active tool loop keeps its affinity alive.
      existing.expiresAt = Date.now() + SESSION_TTL_MS;
      // Delete-then-set keeps Map insertion order ≈ recency for the eviction below.
      this.sessions.delete(storeKey);
      this.sessions.set(storeKey, existing);
      return existing;
    }
    if (existing) this.sessions.delete(storeKey);
    if (this.sessions.size >= MAX_ENTRIES) {
      const oldest = this.sessions.keys().next().value as string;
      this.sessions.delete(oldest);
    }
    const session: CodexSession = {
      sessionId: randomUUID(),
      threadId: randomUUID(),
      promptCacheKey: callerCacheKey ?? randomUUID(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    this.sessions.set(storeKey, session);
    return session;
  }

  /** Lazily evict expired entries to avoid unbounded growth. */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [key, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(key);
    }
  }
}
