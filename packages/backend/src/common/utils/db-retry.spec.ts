import { shouldRetryDbConnection } from './db-retry';

describe('shouldRetryDbConnection', () => {
  it('retries genuine connectivity failures (DB not ready yet)', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    expect(shouldRetryDbConnection(err)).toBe(true);
  });

  it('retries a generic non-migration error rather than masking a transient blip', () => {
    expect(shouldRetryDbConnection(new Error('socket hang up'))).toBe(true);
  });

  it('does NOT retry a QueryFailedError (a failed migration/query statement)', () => {
    const err = new Error('relation "tenant_providers" does not exist');
    err.name = 'QueryFailedError';
    expect(shouldRetryDbConnection(err)).toBe(false);
  });

  it('does NOT retry our explicit re-scope migration abort', () => {
    const err = new Error(
      'TenantProviders migration: 1 user_providers row(s) reference a user with no tenant and cannot be re-scoped.',
    );
    expect(shouldRetryDbConnection(err)).toBe(false);
  });

  it('retries when the error has no usable name/message (unknown shape)', () => {
    expect(shouldRetryDbConnection(null)).toBe(true);
    expect(shouldRetryDbConnection(undefined)).toBe(true);
    expect(shouldRetryDbConnection({})).toBe(true);
    // Non-string name/message must not throw and should default to retrying.
    expect(shouldRetryDbConnection({ name: 123, message: { nested: true } })).toBe(true);
  });
});
