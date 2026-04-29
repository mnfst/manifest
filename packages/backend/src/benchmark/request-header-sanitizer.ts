/**
 * Headers Manifest manages itself — providing these from the client would
 * hijack auth, break routing, or mask our telemetry. Compared case-insensitively.
 */
const BLOCKED_EXACT = new Set<string>([
  // Auth across known providers — letting a user override these would let them
  // smuggle credentials onto a request that's already authenticated by us, or
  // (worse) supplant the legitimate header before it reaches the upstream.
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-goog-api-key',
  'x-amz-security-token',
  'x-azure-token',
  'cookie',
  'set-cookie',
  // Provider account/identity headers — leaking these can expose internal
  // billing and routing identifiers.
  'openai-organization',
  'openai-project',
  'anthropic-version',
  // Transport-layer / hop-by-hop headers (RFC 7230). Forwarding these breaks
  // framing or response parsing.
  'host',
  'content-length',
  'content-type',
  'connection',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'expect',
  'keep-alive',
  'range',
]);

const BLOCKED_PREFIXES = ['x-manifest-', 'x-aws-'];

const MAX_HEADERS = 20;
const MAX_VALUE_LENGTH = 2_000;
// Mirror routing/proxy/request-headers.ts: control characters cannot appear in
// HTTP header values per RFC 7230. undici rejects them today, but stripping at
// our boundary keeps a future relaxation from becoming a header-smuggling vector.
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;

/** Public for testing — exposed as a function so callers can log or display it. */
export function isBlockedHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  if (BLOCKED_EXACT.has(lower)) return true;
  return BLOCKED_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Sanitize user-supplied request headers before forwarding to a provider.
 * Drops blocklist entries silently (the client UI shows a warning; we don't
 * 400 the request). Returns `undefined` when nothing survives — callers can
 * skip the `extraHeaders` field entirely.
 */
export function sanitizeRequestHeaders(
  raw: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (count >= MAX_HEADERS) break;
    if (typeof rawKey !== 'string' || typeof rawValue !== 'string') continue;
    const key = rawKey.trim();
    if (!key) continue;
    if (isBlockedHeaderName(key)) continue;
    const cleaned = rawValue.replace(CONTROL_CHARS_RE, '').slice(0, MAX_VALUE_LENGTH);
    if (!cleaned) continue;
    out[key] = cleaned;
    count++;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
