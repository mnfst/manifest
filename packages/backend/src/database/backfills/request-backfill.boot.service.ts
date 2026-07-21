import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toLocalSqlTimestamp } from '../../common/utils/postgres-sql';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import { BackfillState } from '../../entities/backfill-state.entity';
import {
  runRequestBackfill,
  type RequestBackfillOptions,
  type RequestBackfillResult,
} from './backfill-requests';
import { TypeOrmRequestBackfillGateway } from './backfill-requests.gateway';
import {
  MESSAGE_PROVIDER_BACKFILL_LOCK_KEY,
  MessageProviderBackfillBootService,
} from './message-provider-backfill.boot.service';
import { createRequestBackfillDataSource } from './request-backfill.datasource';

/** Initial historical pass marker; legacy-writer delta is tracked by unlinked rows. */
export const REQUEST_BACKFILL_NAME = 'requests_agent_messages_v1';
// Both post-deploy jobs update agent_messages. Sharing the lock guarantees
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

export const REQUEST_BACKFILL_LOCK_RETRY_MS = 30_000;
export const REQUEST_BACKFILL_FALLBACK_GRACE_MS = 5 * 60_000;
export const REQUEST_BACKFILL_GENERIC_GRACE_MS = 10 * 60_000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });

/**
 * Runs historical regrouping without blocking application readiness. Self-hosted
 * reuses its DATABASE_URL-backed app connection. Cloud opens a separate direct
 * connection so session locks and temporary tables never cross PgBouncer.
 */
@Injectable()
export class RequestBackfillBootService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RequestBackfillBootService.name);
  private stopping = false;
  private ownedDataSource: DataSource | undefined;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BackfillState)
    private readonly stateRepo: Repository<BackfillState>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] !== 'production') return;
    this.stopping = false;
    void this.runManagedBackfill();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    const ownedDataSource = this.ownedDataSource;
    this.ownedDataSource = undefined;
    if (ownedDataSource?.isInitialized) await ownedDataSource.destroy();
  }

  /**
   * Self-hosted reuses its DATABASE_URL-backed application DataSource. Cloud
   * creates a separate direct pool so advisory locks and temporary staging
   * tables never cross transaction-mode PgBouncer.
   */
  private async runManagedBackfill(): Promise<void> {
    while (!this.stopping) {
      try {
        const coordinator = isSelfHosted() ? this : await this.createCloudCoordinator();
        if (!coordinator || this.stopping) return;
        await coordinator.runUntilComplete();
        if (this.stopping) return;
        // This release only stages historical rows. The requests-backed
        // rollout owns the final catch-up of legacy writes.
        await this.releaseCloudCoordinator();
        return;
      } catch (error) {
        await this.releaseCloudCoordinator();
        if (this.stopping) return;
        this.logger.error(
          `post-deploy request backfill failed: ${error instanceof Error ? error.message : String(error)}; retrying in ${REQUEST_BACKFILL_LOCK_RETRY_MS / 1000}s`,
        );
        await wait(REQUEST_BACKFILL_LOCK_RETRY_MS);
      }
    }
  }

  private async createCloudCoordinator(): Promise<RequestBackfillBootService | null> {
    const dataSource = createRequestBackfillDataSource(process.env);
    await dataSource.initialize();
    if (this.stopping) {
      await dataSource.destroy();
      return null;
    }
    this.ownedDataSource = dataSource;
    const stateRepo = dataSource.getRepository(BackfillState);
    // The older provider-attribution task uses the same direct connection in
    // Cloud. Its session advisory lock must never cross transaction PgBouncer.
    await new MessageProviderBackfillBootService(dataSource, stateRepo).runUntilComplete();
    return new RequestBackfillBootService(dataSource, stateRepo);
  }

  private async releaseCloudCoordinator(): Promise<void> {
    const dataSource = this.ownedDataSource;
    this.ownedDataSource = undefined;
    if (dataSource?.isInitialized) await dataSource.destroy().catch(() => undefined);
  }

  async runUntilComplete(): Promise<void> {
    while (!(await this.runOnce())) {
      await wait(REQUEST_BACKFILL_LOCK_RETRY_MS);
    }
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
   * Old replicas write their unchanged column set without request_id.
   * Revisit those rows after a grace period, using a larger delay for generic
   * linking so a fallback terminal always gets another reconstruction pass.
   */
  async runTailOnce(runner: RequestBackfillRunner = defaultRunner): Promise<boolean> {
    const options = this.runOptions(false);
    if (!(await this.hasEligibleAttempts(options.fallbackBefore!))) return true;

    const lock = this.dataSource.createQueryRunner();
    await lock.connect();
    let acquired = false;
    try {
      const rows = (await lock.query('SELECT pg_try_advisory_lock($1) AS locked', [
        REQUEST_BACKFILL_LOCK_KEY,
      ])) as { locked: boolean }[];
      acquired = rows[0]?.locked === true;
      if (!acquired) return false;
      if (!(await this.hasEligibleAttempts(options.fallbackBefore!))) return true;

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

  async hasUnlinkedAttempts(): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM "agent_messages"
         WHERE "request_id" IS NULL
         LIMIT 1
       ) AS pending`,
    )) as { pending: boolean }[];
    return rows[0]?.pending === true;
  }

  private runOptions(
    initial: boolean,
  ): Pick<RequestBackfillOptions, 'analyze' | 'before' | 'fallbackBefore' | 'finalize'> {
    const now = Date.now();
    return {
      analyze: initial,
      finalize: true,
      fallbackBefore: toLocalSqlTimestamp(new Date(now - REQUEST_BACKFILL_FALLBACK_GRACE_MS)),
      before: toLocalSqlTimestamp(new Date(now - REQUEST_BACKFILL_GENERIC_GRACE_MS)),
    };
  }

  private async hasEligibleAttempts(before: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM "agent_messages"
         WHERE "request_id" IS NULL AND timestamp < $1
         LIMIT 1
       ) AS pending`,
      [before],
    )) as { pending: boolean }[];
    return rows[0]?.pending === true;
  }

  private async isCompleted(): Promise<boolean> {
    return (await this.stateRepo.countBy({ name: REQUEST_BACKFILL_NAME })) > 0;
  }
}
