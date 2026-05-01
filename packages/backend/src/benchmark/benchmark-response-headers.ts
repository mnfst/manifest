const ALLOWED_EXACT = new Set<string>([
  'content-type',
  'date',
  'x-request-id',
  'request-id',
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
 * Whitelist outbound response headers before returning them to the browser.
 * Raw provider headers can contain tokens, account identifiers, or
 * fingerprinting data we should not surface. Keep this list narrow.
 */
export function whitelistResponseHeaders(raw: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  raw.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (ALLOWED_EXACT.has(lower) || ALLOWED_PREFIXES.some((p) => lower.startsWith(p))) {
      out[lower] = value;
    }
  });
  return out;
}
