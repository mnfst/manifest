const ALLOWED_EXACT = new Set<string>([
  'content-type',
  'date',
  'server',
  'x-request-id',
  'request-id',
  'cf-ray',
  'openai-model',
  'openai-organization',
  'openai-processing-ms',
  'openai-version',
  'anthropic-ratelimit-requests-limit',
  'anthropic-ratelimit-requests-remaining',
  'anthropic-ratelimit-requests-reset',
  'anthropic-ratelimit-tokens-limit',
  'anthropic-ratelimit-tokens-remaining',
  'anthropic-ratelimit-tokens-reset',
]);

const ALLOWED_PREFIXES = ['x-ratelimit-', 'x-manifest-', 'ratelimit-'];

/**
 * Whitelist outbound response headers before exposing them to the browser
 * or persisting them. Raw provider headers can echo back tokens, account
 * identifiers, or fingerprinting data that should not be surfaced. Keep
 * this list narrow — anything not on it is dropped.
 *
 * Single source of truth shared between the proxy's recording capture and
 * the benchmark's response-headers projection.
 */
export function filterResponseHeaders(raw: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  raw.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (ALLOWED_EXACT.has(lower) || ALLOWED_PREFIXES.some((p) => lower.startsWith(p))) {
      out[lower] = value;
    }
  });
  return out;
}
