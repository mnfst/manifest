/**
 * Decides whether a failed TypeORM DataSource initialization is worth retrying.
 *
 * Migrations run on connect (`migrationsRun: true`), so a failed migration
 * surfaces through @nestjs/typeorm's connection-retry path. Retrying never
 * fixes a bad migration — it just spams the misleading "Unable to connect to
 * the database. Retrying (N)..." line and buries the real
 * "Migration X failed, error: ..." cause the operator needs to see. So we fail
 * fast on migration/query errors and keep retrying only genuine connectivity
 * failures (e.g. the database not being ready yet at boot).
 *
 * Used as the `toRetry` predicate in database.module.ts; @nestjs/typeorm
 * checks it BEFORE logging the retry line, so returning false both suppresses
 * the misleading message and stops the retry loop.
 */
export function shouldRetryDbConnection(err: unknown): boolean {
  const e = (err ?? {}) as { name?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';

  // QueryFailedError = a SQL statement failed after connecting (a migration or
  // query problem), never "database unreachable".
  if (name === 'QueryFailedError') return false;

  // The tenant re-scope migrations throw plain Errors whose message names the
  // migration (e.g. "TenantProviders migration: N row(s) ... cannot be
  // re-scoped").
  if (message.includes('migration')) return false;

  return true;
}
