import type { IncomingHttpHeaders } from 'http';

const MAX_HEADERS = 50;
const MAX_VALUE_BYTES = 1024;
const MAX_TOTAL_BYTES = 8192;
const ELLIPSIS_BYTES = Buffer.byteLength('…', 'utf8');

// Headers that can carry secrets — dropped entirely so they never hit the DB.
const SENSITIVE_HEADERS = new Set<string>([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
]);

export function sanitizeRequestHeaders(
  headers: IncomingHttpHeaders,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  let totalBytes = 2; // account for `{}` of the eventual JSON
  let count = 0;

  for (const [rawKey, rawVal] of Object.entries(headers)) {
    if (count >= MAX_HEADERS) break;
    if (rawVal == null) continue;

    const key = rawKey.toLowerCase();
    if (SENSITIVE_HEADERS.has(key)) continue;

    const joined = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal);
    const cleaned = joined.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (!cleaned) continue;

    const value = truncateUtf8(cleaned, MAX_VALUE_BYTES);

    // Measure the *actual* serialized cost (JSON.stringify handles escaping of
    // quotes, backslashes, control chars) so values full of `"` or `\` can't
    // silently blow past the 8 KB budget.
    const entryBytes =
      Buffer.byteLength(JSON.stringify(key), 'utf8') +
      Buffer.byteLength(JSON.stringify(value), 'utf8') +
      1 + // ":"
      (count === 0 ? 0 : 1); // leading "," for non-first entries
    if (totalBytes + entryBytes > MAX_TOTAL_BYTES) continue;

    out[key] = value;
    totalBytes += entryBytes;
    count++;
  }

  return count > 0 ? out : null;
}

// Truncate by UTF-8 byte length (not character count) so multi-byte values
// can't exceed the byte budget. When the cut lands mid-codepoint, Node's
// Buffer.toString replaces the partial sequence with U+FFFD — strip those so
// the stored value stays valid, then append a single ellipsis.
function truncateUtf8(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return s;
  const budget = Math.max(0, maxBytes - ELLIPSIS_BYTES);
  let sliced = buf.subarray(0, budget).toString('utf8');
  while (sliced.endsWith('\uFFFD')) sliced = sliced.slice(0, -1);
  return sliced + '…';
}
