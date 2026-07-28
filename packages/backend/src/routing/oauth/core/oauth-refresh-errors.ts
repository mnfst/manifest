/**
 * Classification helpers for OAuth token-refresh failures.
 *
 * Rotating refresh tokens (OpenAI and friends) die permanently under a few
 * well-known error codes. Transient failures (network, 5xx, rate limit) must
 * NOT deactivate the stored credential — the next request may still recover.
 */

/** Thrown by refreshAccessToken when the provider rejects the refresh grant. */
export class OAuthRefreshError extends Error {
  constructor(
    message: string,
    readonly responseBody: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'OAuthRefreshError';
  }
}

/**
 * Provider error codes / phrases that mean the stored refresh token can never
 * mint a new access token. Matching is case-insensitive on the raw body.
 */
const PERMANENT_REFRESH_FAILURE_PATTERNS: readonly RegExp[] = [
  /invalid_refresh_token/i,
  /refresh_token_reused/i,
  /refresh_token_invalidated/i,
  /"error"\s*:\s*"invalid_grant"/i,
  /could not validate your refresh token/i,
  /refresh token has already been used/i,
  /token has been expired or revoked/i,
];

export function isPermanentOAuthRefreshFailure(err: unknown): boolean {
  if (!(err instanceof OAuthRefreshError)) return false;
  const body = err.responseBody ?? '';
  return PERMANENT_REFRESH_FAILURE_PATTERNS.some((re) => re.test(body));
}
