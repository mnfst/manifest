import { shouldRetryDbConnection } from './db-retry';

describe('shouldRetryDbConnection', () => {
  it('retries transport-level connection codes (DB not reachable yet)', () => {
    // code present (string) → matched; no message exercises the empty-message path.
    expect(shouldRetryDbConnection({ code: 'ECONNREFUSED' })).toBe(true);
  });

  it('retries transport failures pg reports as a message without a code', () => {
    expect(shouldRetryDbConnection(new Error('Connection terminated unexpectedly'))).toBe(true);
  });

  it('does NOT retry a failed migration / query error (not transport-level)', () => {
    const queryErr = new Error('relation "tenant_providers" does not exist');
    queryErr.name = 'QueryFailedError';
    expect(shouldRetryDbConnection(queryErr)).toBe(false);

    expect(
      shouldRetryDbConnection(
        new Error(
          'TenantProviders migration: 1 user_providers row(s) reference a user with no tenant and cannot be re-scoped.',
        ),
      ),
    ).toBe(false);
  });

  it('does NOT retry unknown / shapeless errors (fail fast rather than mask)', () => {
    expect(shouldRetryDbConnection(null)).toBe(false);
    expect(shouldRetryDbConnection(undefined)).toBe(false);
    expect(shouldRetryDbConnection({})).toBe(false);
    // Non-string code/message must not throw and must not count as transport.
    expect(shouldRetryDbConnection({ code: 123, message: { nested: true } })).toBe(false);
  });
});
