import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BackfillState } from '../../entities/backfill-state.entity';
import { runRequestBackfill, type RequestBackfillResult } from './backfill-requests';
import { TypeOrmRequestBackfillGateway } from './backfill-requests.gateway';
import { MESSAGE_PROVIDER_BACKFILL_LOCK_KEY } from './message-provider-backfill.boot.service';

export const REQUEST_BACKFILL_NAME = 'requests_provider_attempts_v1';
// Both post-deploy jobs update provider_attempts. Sharing the lock guarantees
// that Cloud never runs their batches concurrently; a skipped job resumes on
// the next replica boot because its completion marker remains absent.
export const REQUEST_BACKFILL_LOCK_KEY = MESSAGE_PROVIDER_BACKFILL_LOCK_KEY;

type RequestBackfillRunner = (dataSource: DataSource) => Promise<RequestBackfillResult>;

const defaultRunner: RequestBackfillRunner = (dataSource) =>
  runRequestBackfill(new TypeOrmRequestBackfillGateway(dataSource));

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
    void this.runOnce().catch((error) => {
      this.logger.error(
        `post-deploy request backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async runOnce(runner: RequestBackfillRunner = defaultRunner): Promise<void> {
    if (await this.isCompleted()) return;
    const lock = this.dataSource.createQueryRunner();
    await lock.connect();
    let acquired = false;
    try {
      const rows = (await lock.query('SELECT pg_try_advisory_lock($1) AS locked', [
        REQUEST_BACKFILL_LOCK_KEY,
      ])) as { locked: boolean }[];
      acquired = rows[0]?.locked === true;
      if (!acquired) {
        this.logger.log('another instance is running the request backfill; skipping');
        return;
      }
      if (await this.isCompleted()) return;
      this.logger.log('running post-deploy request/provider-attempt backfill…');
      const result = await runner(this.dataSource);
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
