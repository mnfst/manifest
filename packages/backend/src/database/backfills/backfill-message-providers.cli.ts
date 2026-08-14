import 'dotenv/config';
import { DataSource } from 'typeorm';

import {
  BackfillOptions,
  BackfillResult,
  runMessageProviderBackfill,
} from './backfill-message-providers';
import { TypeOrmBackfillGateway } from './backfill-message-providers.gateway';

const DEFAULT_DATABASE_URL = 'postgresql://myuser:mypassword@localhost:5432/mydatabase';

/** Tunable knobs, read from the environment (all optional). */
export function readBackfillOptions(env: NodeJS.ProcessEnv): BackfillOptions {
  const num = (raw: string | undefined): number | undefined => {
    if (raw === undefined || raw.trim() === '') {
      return undefined;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    batchSize: num(env['BACKFILL_BATCH_SIZE']),
    throttleMs: num(env['BACKFILL_THROTTLE_MS']),
    lockTimeoutMs: num(env['BACKFILL_LOCK_TIMEOUT_MS']),
    statementTimeoutMs: num(env['BACKFILL_STATEMENT_TIMEOUT_MS']),
    maxRetries: num(env['BACKFILL_MAX_RETRIES']),
    retryBackoffMs: num(env['BACKFILL_RETRY_BACKOFF_MS']),
  };
}

/** A no-entity DataSource — the backfill is raw SQL, so it needs no metadata. */
export function createBackfillDataSource(env: NodeJS.ProcessEnv): DataSource {
  const url = env['MIGRATION_DATABASE_URL'] ?? env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL;
  return new DataSource({ type: 'postgres', url });
}

export interface MainDeps {
  env?: NodeJS.ProcessEnv;
  logger?: { log: (message: string) => void; error: (message: unknown) => void };
  dataSource?: DataSource;
}

export async function main(deps: MainDeps = {}): Promise<BackfillResult> {
  const env = deps.env ?? process.env;
  const logger = deps.logger ?? console;
  const dataSource = deps.dataSource ?? createBackfillDataSource(env);
  await dataSource.initialize();
  try {
    const result = await runMessageProviderBackfill(new TypeOrmBackfillGateway(dataSource), {
      ...readBackfillOptions(env),
      logger,
    });
    logger.log(
      `Backfill complete: stamped ${result.stamped} message(s) across ${result.windows} window(s).`,
    );
    return result;
  } finally {
    await dataSource.destroy();
  }
}

/* istanbul ignore next -- thin process entrypoint, exercised on staging/prod, not in unit tests */
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
