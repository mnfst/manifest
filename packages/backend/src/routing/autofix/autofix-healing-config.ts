export const DEFAULT_HOSTED_AUTOFIX_URL = 'https://autofix.manifest.build';

/**
 * A healer URL must be an absolute http(s) origin. Anything else — a bare host,
 * a typo'd scheme, a `postgres://` pasted into the wrong variable — would be
 * handed to `fetch()` and surface later as an opaque per-request failure on the
 * heal path. Rejecting it here means a misconfigured deployment falls back to
 * the inert client instead, which matches Auto-fix's rule that healing never
 * makes a request worse.
 */
function isUsableHealerUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    // A path segment would double-prefix downstream (`/api/heal` built onto a
    // base already carrying a path), so only an origin is a valid healer URL.
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.pathname === '' || parsed.pathname === '/')
    );
  } catch {
    return false;
  }
}

/**
 * Resolve only real HTTP healers. Dev/test keeps using the in-process mock when
 * the URL is unset; cloud production keeps its inert default.
 *
 * Returns `{ url, invalid }` so the caller can log the misconfiguration once at
 * boot rather than silently behaving as if nothing were configured.
 */
export function resolveHealingUrl(
  rawUrl: string | undefined,
  nodeEnv: string | undefined,
  selfHosted: boolean,
): { url: string | undefined; invalid: boolean } {
  const value = rawUrl?.trim();
  if (value?.toLowerCase() === 'off') return { url: undefined, invalid: false };
  if (value) {
    return isUsableHealerUrl(value)
      ? { url: value, invalid: false }
      : { url: undefined, invalid: true };
  }
  if (nodeEnv === 'production' && selfHosted) {
    return { url: DEFAULT_HOSTED_AUTOFIX_URL, invalid: false };
  }
  return { url: undefined, invalid: false };
}

/** Back-compat shape for callers that only need the resolved URL. */
export function resolveHttpHealingUrl(
  rawUrl: string | undefined,
  nodeEnv: string | undefined,
  selfHosted: boolean,
): string | undefined {
  return resolveHealingUrl(rawUrl, nodeEnv, selfHosted).url;
}
