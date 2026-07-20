import { DataSource } from 'typeorm';

import { BackfillState } from '../../entities/backfill-state.entity';

const DEFAULT_DATABASE_URL = 'postgresql://myuser:mypassword@localhost:5432/mydatabase';

/**
 * Resolve the direct connection used by Cloud migration/backfill workers.
 * Self-hosted boot never calls this helper; it reuses the application's
 * DATABASE_URL-backed DataSource instead.
 */
export function resolveRequestBackfillDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const directUrl =
    env['BACKFILL_DATABASE_URL'] ?? env['MIGRATION_DATABASE_URL'] ?? env['DATABASE_UNPOOLED_URL'];
  if (directUrl) return directUrl;

  if (env['NODE_ENV'] === 'production') {
    throw new Error(
      'A direct PostgreSQL URL is required in Cloud production; set BACKFILL_DATABASE_URL or MIGRATION_DATABASE_URL',
    );
  }
  return env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL;
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
