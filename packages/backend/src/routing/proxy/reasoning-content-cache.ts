const TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * In-memory cache for DeepSeek (and compatible) reasoning_content strings.
 *
 * When a reasoning model returns `reasoning_content` alongside `tool_calls`,
 * OpenAI-compat clients strip the field when building the conversation history
 * for the next turn. The provider then rejects the request:
 *
 *   "The reasoning_content in the thinking mode must be passed back to the API."
 *
 * Manifest caches the reasoning_content here and re-injects it into the
 * matching assistant message when forwarding the next turn.
 *
 * Keyed by `${sessionKey}:${firstToolCallId}` — the first tool_call id from
 * the assistant turn uniquely identifies it within the session, and the client
 * echoes those ids back unchanged in subsequent requests.
 */
export class ReasoningContentCache {
  private cache = new Map<string, { content: string; expiresAt: number }>();
  private lastCleanup = Date.now();

  /** Store the reasoning_content string for an assistant turn. */
  store(sessionKey: string, firstToolCallId: string, content: string): void {
    if (!content) return;
    this.maybeCleanup();
    this.cache.set(`${sessionKey}:${firstToolCallId}`, {
      content,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  /** Retrieve the cached reasoning_content, or null if not found/expired. */
  retrieve(sessionKey: string, firstToolCallId: string): string | null {
    const entry = this.cache.get(`${sessionKey}:${firstToolCallId}`);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(`${sessionKey}:${firstToolCallId}`);
      return null;
    }
    return entry.content;
  }

  /** Clear all cached entries for a session. */
  clearSession(sessionKey: string): void {
    const prefix = `${sessionKey}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}
