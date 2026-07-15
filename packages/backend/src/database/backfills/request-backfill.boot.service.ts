import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toLocalSqlTimestamp } from '../../common/utils/postgres-sql';
import { BackfillState } from '../../entities/backfill-state.entity';
import {
  runRequestBackfill,
  type RequestBackfillOptions,
  type RequestBackfillResult,
} from './backfill-requests';
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
  options: Pick<RequestBackfillOptions, 'analyze' | 'before' | 'fallbackBefore' | 'finalize'>,
) => Promise<RequestBackfillResult>;

const defaultRunner: RequestBackfillRunner = (dataSource, logger, options) =>
  runRequestBackfill(new TypeOrmRequestBackfillGateway(dataSource), { logger, ...options });

const LOCK_RETRY_MS = 30_000;
export const REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS = 10;
export const REQUEST_BACKFILL_TAIL_INTERVAL_MS = 60_000;
export const REQUEST_BACKFILL_FALLBACK_GRACE_MS = 5 * 60_000;
export const REQUEST_BACKFILL_GENERIC_GRACE_MS = 10 * 60_000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });

/** Runs historical regrouping after readiness, never in the deploy migration. */
@Injectable()
export class RequestBackfillBootService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RequestBackfillBootService.name);
  private tailTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BackfillState)
    private readonly stateRepo: Repository<BackfillState>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] !== 'production') return;
    void this.runUntilComplete()
      .then(() => this.startTailSweep())
      .catch((error) => {
        this.logger.error(
          `post-deploy request backfill failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  onApplicationShutdown(): void {
    if (this.tailTimer) clearInterval(this.tailTimer);
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
      const result = await runner(this.dataSource, this.logger, this.runOptions(true));
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

  /**
   * Old replicas write through the compatibility view without request_id.
   * Revisit those rows after a grace period, using a larger delay for generic
   * linking so a fallback terminal always gets another reconstruction pass.
   */
  async runTailOnce(runner: RequestBackfillRunner = defaultRunner): Promise<boolean> {
    const options = this.runOptions(false);
    if (!(await this.hasEligibleAttempts(options.before!))) return true;

    const lock = this.dataSource.createQueryRunner();
    await lock.connect();
    let acquired = false;
    try {
      const rows = (await lock.query('SELECT pg_try_advisory_lock($1) AS locked', [
        REQUEST_BACKFILL_LOCK_KEY,
      ])) as { locked: boolean }[];
      acquired = rows[0]?.locked === true;
      if (!acquired) return false;
      if (!(await this.hasEligibleAttempts(options.before!))) return true;

      const result = await runner(this.dataSource, this.logger, options);
      this.logger.log(
        `request backfill tail sweep: ${result.attempts} attempt(s), ${result.rejections} rejection(s), ${result.windows} window(s)`,
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

  private async startTailSweep(): Promise<void> {
    if (!(await this.hasCompatibilityView())) return;
    this.tailTimer = setInterval(() => {
      void this.runTailOnce().catch((error) => {
        this.logger.error(
          `request backfill tail sweep failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, REQUEST_BACKFILL_TAIL_INTERVAL_MS);
    if (typeof this.tailTimer === 'object' && 'unref' in this.tailTimer) this.tailTimer.unref();
  }

  private runOptions(
    initial: boolean,
  ): Pick<RequestBackfillOptions, 'analyze' | 'before' | 'fallbackBefore' | 'finalize'> {
    const now = Date.now();
    return {
      analyze: initial,
      finalize: initial,
      fallbackBefore: toLocalSqlTimestamp(new Date(now - REQUEST_BACKFILL_FALLBACK_GRACE_MS)),
      before: toLocalSqlTimestamp(new Date(now - REQUEST_BACKFILL_GENERIC_GRACE_MS)),
    };
  }

  private async hasEligibleAttempts(before: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM "provider_attempts"
         WHERE "request_id" IS NULL AND timestamp < $1
         LIMIT 1
       ) AS pending`,
      [before],
    )) as { pending: boolean }[];
    return rows[0]?.pending === true;
  }

  private async hasCompatibilityView(): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'agent_messages' AND c.relkind = 'v'
       ) AS present`,
    )) as { present: boolean }[];
    return rows[0]?.present === true;
  }

  private async isCompleted(): Promise<boolean> {
    return (await this.stateRepo.countBy({ name: REQUEST_BACKFILL_NAME })) > 0;
  }
}
