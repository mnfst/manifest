import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, QueryRunner } from 'typeorm';
import { isBillingEnabled } from '../billing/billing.config';
import { RequestRecordingStorageService } from '../common/services/request-recording-storage.service';
import type { RequestRecordingStorageBackend } from '../entities/request-recording.entity';

const FREE_RETENTION_DAYS = 7;
const PRO_RETENTION_DAYS = 365;
const NON_BILLING_RETENTION_DAYS = 365;
const RETENTION_LOCK_KEY = 4011986;

const TRY_LOCK_SQL = `
  SELECT pg_try_advisory_lock(${RETENTION_LOCK_KEY}::bigint) AS acquired
`;

const UNLOCK_SQL = `SELECT pg_advisory_unlock(${RETENTION_LOCK_KEY}::bigint)`;

const SELECT_ALL_EXPIRED_SQL = `
  SELECT request_id, storage_key, storage_backend
  FROM request_recordings
  WHERE created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
  ORDER BY created_at ASC
`;

const SELECT_PLAN_EXPIRED_SQL = `
  SELECT recording.request_id, recording.storage_key, recording.storage_backend
  FROM request_recordings recording
  JOIN requests request ON request.id = recording.request_id
  WHERE (
    (
      recording.created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
      AND NOT EXISTS (
        SELECT 1
        FROM tenants tenant
        JOIN "subscription" subscription
          ON subscription."referenceId" = tenant.owner_user_id
        WHERE tenant.id = request.tenant_id
          AND subscription.plan = 'pro'
          AND subscription.status IN ('active', 'trialing')
      )
    )
    OR (
      recording.created_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 day')
      AND EXISTS (
        SELECT 1
        FROM tenants tenant
        JOIN "subscription" subscription
          ON subscription."referenceId" = tenant.owner_user_id
        WHERE tenant.id = request.tenant_id
          AND subscription.plan = 'pro'
          AND subscription.status IN ('active', 'trialing')
      )
    )
  )
  ORDER BY recording.created_at ASC
`;

const DELETE_METADATA_SQL = `
  DELETE FROM request_recordings
  WHERE request_id = $1 AND storage_key = $2
  RETURNING request_id
`;

interface ExpiredRecording {
  request_id: string;
  storage_key: string;
  storage_backend: RequestRecordingStorageBackend;
}

@Injectable()
export class RequestRecordingRetentionService {
  private readonly logger = new Logger(RequestRecordingRetentionService.name);
  private readonly globalRetentionDays: number | null;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
    private readonly storage: RequestRecordingStorageService,
  ) {
    this.globalRetentionDays =
      config.get<number | null>('app.requestRecordingRetentionDays') ?? null;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'request-recording-retention',
    waitForCompletion: true,
  })
  async deleteExpiredRecordings(): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    let acquired = false;
    try {
      await queryRunner.connect();
      const lockRows = (await queryRunner.query(TRY_LOCK_SQL)) as Array<{ acquired?: boolean }>;
      acquired = lockRows[0]?.acquired === true;
      if (!acquired) return 0;

      const recordings =
        this.globalRetentionDays !== null || !isBillingEnabled()
          ? await this.findAllExpired(
              queryRunner,
              this.globalRetentionDays ?? NON_BILLING_RETENTION_DAYS,
            )
          : await this.findExpiredByPlan(queryRunner);
      const deleted = await this.deleteRecordings(queryRunner, recordings);

      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} expired request recording(s)`);
      }
      return deleted;
    } catch (error) {
      this.logger.error(
        `Request recording retention failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    } finally {
      if (acquired) await queryRunner.query(UNLOCK_SQL).catch(() => undefined);
      await queryRunner.release().catch(() => undefined);
    }
  }

  private async findAllExpired(
    queryRunner: QueryRunner,
    retentionDays: number,
  ): Promise<ExpiredRecording[]> {
    return queryRunner.query(SELECT_ALL_EXPIRED_SQL, [retentionDays]) as Promise<
      ExpiredRecording[]
    >;
  }

  private async findExpiredByPlan(queryRunner: QueryRunner): Promise<ExpiredRecording[]> {
    return queryRunner.query(SELECT_PLAN_EXPIRED_SQL, [
      FREE_RETENTION_DAYS,
      PRO_RETENTION_DAYS,
    ]) as Promise<ExpiredRecording[]>;
  }

  private async deleteRecordings(
    queryRunner: QueryRunner,
    recordings: ExpiredRecording[],
  ): Promise<number> {
    let deleted = 0;
    for (const recording of recordings) {
      try {
        await this.storage.delete(recording.storage_backend, recording.storage_key);
        const result = (await queryRunner.query(DELETE_METADATA_SQL, [
          recording.request_id,
          recording.storage_key,
        ])) as Array<{ request_id: string }> | [Array<{ request_id: string }>, number];
        const rows = Array.isArray(result[0]) ? result[0] : result;
        deleted += rows.length;
      } catch (error) {
        this.logger.warn(
          `Could not delete request recording ${recording.request_id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return deleted;
  }
}
