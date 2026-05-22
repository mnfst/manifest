interface CachedReasoningContent {
  content: string;
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory cache for OpenAI-compatible `reasoning_content` strings.
 *
 * DeepSeek-compatible reasoning providers require assistant tool-call turns to
 * be replayed with the same `reasoning_content` they returned. Generic
 * OpenAI-compatible SDKs often drop that provider-specific field when they
 * rebuild conversation history, so Manifest caches it by the first tool call id
 * and restores it before forwarding the next turn to a compatible provider.
 */
export class ReasoningContentCache {
  private cache = new Map<string, CachedReasoningContent>();
  private lastCleanup = Date.now();

  /** Store the reasoning_content string for an assistant tool-call turn. */
  store(sessionKey: string, firstToolCallId: string, content: string): void {
    if (!content) return;
    this.maybeCleanup();
    this.cache.set(`${sessionKey}:${firstToolCallId}`, {
      content,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  /** Retrieve cached reasoning_content, or null if not found/expired. */
  retrieve(sessionKey: string, firstToolCallId: string): string | null {
    const entry = this.cache.get(`${sessionKey}:${firstToolCallId}`);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(`${sessionKey}:${firstToolCallId}`);
      return null;
    }
    return entry.content;
  }

  /** Clear all cached reasoning_content for a session. */
  clearSession(sessionKey: string): void {
    const prefix = `${sessionKey}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  /** Lazily evict expired entries to avoid unbounded growth. */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}
