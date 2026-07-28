import { isPermanentOAuthRefreshFailure, OAuthRefreshError } from './oauth-refresh-errors';

describe('isPermanentOAuthRefreshFailure', () => {
  it('is false for non-OAuthRefreshError values (e.g. persist failures)', () => {
    expect(isPermanentOAuthRefreshFailure(new Error('Token refresh failed'))).toBe(false);
    expect(isPermanentOAuthRefreshFailure(new Error('db write failed'))).toBe(false);
    expect(isPermanentOAuthRefreshFailure(null)).toBe(false);
  });

  it.each([
    ['invalid_refresh_token', '{"error":"invalid_refresh_token","error_description":"Could not validate your refresh token"}'],
    ['refresh_token_reused', '{"error":"refresh_token_reused","error_description":"Your refresh token has already been used to generate a new access token"}'],
    ['refresh_token_invalidated', 'error=refresh_token_invalidated'],
    ['invalid_grant', '{"error":"invalid_grant","error_description":"Bad Request"}'],
    ['expired or revoked', 'Token has been expired or revoked'],
  ])('is true for permanent provider failure: %s', (_name, body) => {
    expect(isPermanentOAuthRefreshFailure(new OAuthRefreshError('Token refresh failed', body, 400))).toBe(
      true,
    );
  });

  it('is false for transient provider failures', () => {
    expect(
      isPermanentOAuthRefreshFailure(
        new OAuthRefreshError('Token refresh failed', '{"error":"server_error"}', 500),
      ),
    ).toBe(false);
    expect(
      isPermanentOAuthRefreshFailure(
        new OAuthRefreshError('Token refresh failed', '{"error":"temporarily_unavailable"}', 503),
      ),
    ).toBe(false);
    expect(
      isPermanentOAuthRefreshFailure(new OAuthRefreshError('Token refresh failed', 'rate limited', 429)),
    ).toBe(false);
  });
});
