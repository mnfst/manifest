import { filterResponseHeaders } from '../common/utils/response-header-allowlist';

/**
 * Whitelist outbound response headers before returning them to the browser.
 * Delegates to the shared `filterResponseHeaders` so the proxy's recording
 * capture and the benchmark's response projection cannot drift.
 */
export function whitelistResponseHeaders(raw: Headers): Record<string, string> {
  return filterResponseHeaders(raw);
}
