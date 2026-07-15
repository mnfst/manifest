import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BackfillState } from '../../entities/backfill-state.entity';
import { runRequestBackfill, type RequestBackfillResult } from './backfill-requests';
import { TypeOrmRequestBackfillGateway } from './backfill-requests.gateway';
import { MESSAGE_PROVIDER_BACKFILL_LOCK_KEY } from './message-provider-backfill.boot.service';

export const REQUEST_BACKFILL_NAME = 'requests_provider_attempts_v1';
// Both post-deploy jobs update provider_attempts. Sharing the lock guarantees
// that Cloud never runs their batches concurrently; a contending job releases
// its connection and retries until both completion markers exist.
export const REQUEST_BACKFILL_LOCK_KEY = MESSAGE_PROVIDER_BACKFILL_LOCK_KEY;

type RequestBackfillRunner = (
  dataSource: DataSource,
  logger: Pick<Logger, 'log'>,
) => Promise<RequestBackfillResult>;

const defaultRunner: RequestBackfillRunner = (dataSource, logger) =>
  runRequestBackfill(new TypeOrmRequestBackfillGateway(dataSource), { logger });

const LOCK_RETRY_MS = 30_000;
export const REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS = 10;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });

/** Runs historical regrouping after readiness, never in the deploy migration. */
@Injectable()
export class RequestBackfillBootService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RequestBackfillBootService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BackfillState)
    private readonly stateRepo: Repository<BackfillState>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] !== 'production') return;
    void this.runUntilComplete().catch((error) => {
      this.logger.error(
        `post-deploy request backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private async runUntilComplete(): Promise<void> {
    for (let attempt = 1; attempt <= REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS; attempt += 1) {
      if (await this.runOnce()) return;
      if (attempt < REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS) await wait(LOCK_RETRY_MS);
    }
    throw new Error(
      `request backfill lock stayed busy for ${REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS} attempts`,
    );
  }

  async runOnce(runner: RequestBackfillRunner = defaultRunner): Promise<boolean> {
    if (await this.isCompleted()) return true;
    const lock = this.dataSource.createQueryRunner();
    await lock.connect();
    let acquired = false;
    try {
      const rows = (await lock.query('SELECT pg_try_advisory_lock($1) AS locked', [
        REQUEST_BACKFILL_LOCK_KEY,
      ])) as { locked: boolean }[];
      acquired = rows[0]?.locked === true;
      if (!acquired) {
        this.logger.log('another backfill is running; retrying request backfill later');
        return false;
      }
      if (await this.isCompleted()) return true;
      this.logger.log('running post-deploy request/provider-attempt backfill…');
      const result = await runner(this.dataSource, this.logger);
      await this.stateRepo
        .createQueryBuilder()
        .insert()
        .into(BackfillState)
        .values({ name: REQUEST_BACKFILL_NAME })
        .orIgnore()
        .execute();
      this.logger.log(
        `request backfill complete: ${result.attempts} attempt(s), ${result.rejections} rejection(s), ${result.windows} window(s)`,
      );
      return true;
    } finally {
      if (acquired) {
        await lock
          .query('SELECT pg_advisory_unlock($1)', [REQUEST_BACKFILL_LOCK_KEY])
          .catch(() => undefined);
      }
      await lock.release();
    }
  }

  private async isCompleted(): Promise<boolean> {
    return (await this.stateRepo.countBy({ name: REQUEST_BACKFILL_NAME })) > 0;
  }
}
