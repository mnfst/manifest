import { DataSource } from 'typeorm';

/**
 * Fixed key for the migration advisory lock. Every Manifest process that runs
 * migrations (the pre-deploy step, Railway replicas across regions, overlapping
 * deployments) contends on this one key, so migrations run strictly one at a
 * time instead of deadlocking while acquiring DDL locks on the high-churn
 * agent_messages table (the multi-replica deploy deadlock this guards against).
 */
export const MIGRATION_ADVISORY_LOCK_KEY = 4011985;

/**
 * Run pending migrations while holding a PostgreSQL session advisory lock, so
 * concurrent runners serialize: the first holder applies every pending
 * migration; the others block on the lock, then find nothing pending and no-op.
 *
 * The lock is session-scoped, so this MUST run over a direct connection (the
 * migration DataSource uses MIGRATION_DATABASE_URL, not the PgBouncer pool —
 * transaction pooling would not preserve a session lock).
 */
export async function runMigrationsWithAdvisoryLock(dataSource: DataSource): Promise<void> {
  // Dedicated connection holds the lock for the whole run; runMigrations() uses
  // its own connection from the pool, which the advisory lock does not block.
  const lockRunner = dataSource.createQueryRunner();
  await lockRunner.connect();
  let locked = false;
  try {
    await lockRunner.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_ADVISORY_LOCK_KEY]);
    locked = true;
    // 'each' (per-migration transaction), not 'all': the index migrations run
    // CONCURRENTLY and must execute outside a transaction (transaction = false),
    // which TypeORM forbids under 'all'.
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    if (locked) {
      try {
        await lockRunner.query('SELECT pg_advisory_unlock($1::bigint)', [
          MIGRATION_ADVISORY_LOCK_KEY,
        ]);
      } catch {
        // Best effort — the lock is also released when this connection closes.
      }
    }
    await lockRunner.release();
  }
}
