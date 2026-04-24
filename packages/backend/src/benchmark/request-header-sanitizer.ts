/**
 * Headers Manifest manages itself — providing these from the client would
 * hijack auth, break routing, or mask our telemetry. Compared case-insensitively.
 */
const BLOCKED_EXACT = new Set<string>([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'host',
  'content-length',
  'content-type',
  'connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
]);

const BLOCKED_PREFIXES = ['x-manifest-'];

const MAX_HEADERS = 20;
const MAX_VALUE_LENGTH = 2_000;

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
    out[key] = rawValue.slice(0, MAX_VALUE_LENGTH);
    count++;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
