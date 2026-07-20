import 'dotenv/config';
import { DataSource } from 'typeorm';

import { BackfillState } from '../../entities/backfill-state.entity';
import {
  REQUEST_BACKFILL_GENERIC_GRACE_MS,
  REQUEST_BACKFILL_LOCK_RETRY_MS,
  RequestBackfillBootService,
} from './request-backfill.boot.service';

const DEFAULT_DATABASE_URL = 'postgresql://myuser:mypassword@localhost:5432/mydatabase';

export function resolveRequestBackfillDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const directUrl =
    env['BACKFILL_DATABASE_URL'] ?? env['MIGRATION_DATABASE_URL'] ?? env['DATABASE_UNPOOLED_URL'];
  if (directUrl) return directUrl;

  if (env['NODE_ENV'] === 'production') {
    throw new Error(
      'A direct PostgreSQL URL is required in production; set BACKFILL_DATABASE_URL or MIGRATION_DATABASE_URL',
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

interface BackfillCoordinator {
  runUntilComplete(): Promise<void>;
  runTailOnce(): Promise<boolean>;
  hasUnlinkedAttempts(): Promise<boolean>;
}

export interface MainDeps {
  env?: NodeJS.ProcessEnv;
  logger?: { log: (message: string) => void; error: (message: unknown) => void };
  dataSource?: DataSource;
  coordinator?: BackfillCoordinator;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Run after the new Railway deployment is healthy and the old replica drained. */
export async function main(deps: MainDeps = {}): Promise<void> {
  const env = deps.env ?? process.env;
  const logger = deps.logger ?? console;
  const sleep = deps.sleep ?? realSleep;
  const dataSource = deps.dataSource ?? createRequestBackfillDataSource(env);

  await dataSource.initialize();
  try {
    const coordinator =
      deps.coordinator ??
      new RequestBackfillBootService(dataSource, dataSource.getRepository(BackfillState));
    await coordinator.runUntilComplete();

    // Old replicas can write through the compatibility view during the rolling
    // handover. If any remain after the historical pass, give the last one a
    // full generic grace window, then perform one explicit catch-up.
    while (await coordinator.hasUnlinkedAttempts()) {
      logger.log(`waiting ${REQUEST_BACKFILL_GENERIC_GRACE_MS / 1000}s for legacy writes to age`);
      await sleep(REQUEST_BACKFILL_GENERIC_GRACE_MS);
      while (!(await coordinator.runTailOnce())) {
        await sleep(REQUEST_BACKFILL_LOCK_RETRY_MS);
      }
    }
    logger.log('request/provider-attempt backfill and catch-up complete');
  } finally {
    await dataSource.destroy();
  }
}

/* istanbul ignore next -- thin process entrypoint, exercised by the Railway worker */
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
