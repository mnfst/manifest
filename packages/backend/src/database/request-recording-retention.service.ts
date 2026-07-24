import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { isBillingEnabled } from '../billing/billing.config';

const FREE_RETENTION_DAYS = 7;
const PRO_RETENTION_DAYS = 365;
const NON_BILLING_RETENTION_DAYS = 365;
const RETENTION_LOCK_KEY = 4011986;

const DELETE_ALL_EXPIRED_SQL = `
  WITH retention_lock AS MATERIALIZED (
    SELECT pg_try_advisory_xact_lock(${RETENTION_LOCK_KEY}::bigint) AS acquired
  ),
  deleted AS (
    DELETE FROM request_recordings
    WHERE (SELECT acquired FROM retention_lock)
      AND created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
    RETURNING 1
  )
  SELECT COUNT(*)::int AS deleted FROM deleted
`;

const DELETE_PLAN_EXPIRED_SQL = `
  WITH retention_lock AS MATERIALIZED (
    SELECT pg_try_advisory_xact_lock(${RETENTION_LOCK_KEY}::bigint) AS acquired
  ),
  deleted_free AS (
    DELETE FROM request_recordings recording
    USING requests request
    WHERE (SELECT acquired FROM retention_lock)
      AND recording.request_id = request.id
      AND recording.created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
      AND NOT EXISTS (
        SELECT 1
        FROM tenants tenant
        JOIN "subscription" subscription
          ON subscription."referenceId" = tenant.owner_user_id
        WHERE tenant.id = request.tenant_id
          AND subscription.plan = 'pro'
          AND subscription.status IN ('active', 'trialing')
      )
    RETURNING 1
  ),
  deleted_pro AS (
    DELETE FROM request_recordings recording
    USING requests request
    WHERE (SELECT acquired FROM retention_lock)
      AND recording.request_id = request.id
      AND recording.created_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 day')
      AND EXISTS (
        SELECT 1
        FROM tenants tenant
        JOIN "subscription" subscription
          ON subscription."referenceId" = tenant.owner_user_id
        WHERE tenant.id = request.tenant_id
          AND subscription.plan = 'pro'
          AND subscription.status IN ('active', 'trialing')
      )
    RETURNING 1
  )
  SELECT (
    (SELECT COUNT(*) FROM deleted_free) +
    (SELECT COUNT(*) FROM deleted_pro)
  )::int AS deleted
`;

@Injectable()
export class RequestRecordingRetentionService {
  private readonly logger = new Logger(RequestRecordingRetentionService.name);
  private readonly globalRetentionDays: number | null;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.globalRetentionDays =
      config.get<number | null>('app.requestRecordingRetentionDays') ?? null;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'request-recording-retention',
    waitForCompletion: true,
  })
  async deleteExpiredRecordings(): Promise<number> {
    try {
      const deleted =
        this.globalRetentionDays !== null || !isBillingEnabled()
          ? await this.deleteAllExpired(this.globalRetentionDays ?? NON_BILLING_RETENTION_DAYS)
          : await this.deleteExpiredByPlan();

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
    }
  }

  private async deleteAllExpired(retentionDays: number): Promise<number> {
    return this.deletedCount(await this.dataSource.query(DELETE_ALL_EXPIRED_SQL, [retentionDays]));
  }

  private async deleteExpiredByPlan(): Promise<number> {
    return this.deletedCount(
      await this.dataSource.query(DELETE_PLAN_EXPIRED_SQL, [
        FREE_RETENTION_DAYS,
        PRO_RETENTION_DAYS,
      ]),
    );
  }

  private deletedCount(rows: Array<{ deleted?: number | string }>): number {
    return Number(rows[0]?.deleted ?? 0);
  }
}
