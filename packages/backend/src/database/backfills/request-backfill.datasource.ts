import { DataSource } from 'typeorm';

import { BackfillState } from '../../entities/backfill-state.entity';

/**
 * Resolve the direct connection used by Cloud migration/backfill workers.
 * Self-hosted boot never calls this helper; it reuses the application's
 * DATABASE_URL-backed DataSource instead. The standalone worker always fails
 * closed: NODE_ENV is not a reliable signal that DATABASE_URL bypasses a
 * transaction-mode pooler.
 */
export function resolveRequestBackfillDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const directUrl =
    env['BACKFILL_DATABASE_URL'] ?? env['MIGRATION_DATABASE_URL'] ?? env['DATABASE_UNPOOLED_URL'];
  if (directUrl) return directUrl;

  throw new Error(
    'A direct PostgreSQL URL is required; set BACKFILL_DATABASE_URL, MIGRATION_DATABASE_URL, or DATABASE_UNPOOLED_URL',
  );
}

/** Two direct connections: one holds the advisory lock, one runs backfill SQL. */
export function createRequestBackfillDataSource(env: NodeJS.ProcessEnv): DataSource {
  return new DataSource({
    type: 'postgres',
    url: resolveRequestBackfillDatabaseUrl(env),
    entities: [BackfillState],
    extra: { max: 2 },
  });
}
