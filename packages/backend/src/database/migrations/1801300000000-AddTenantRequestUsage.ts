import { MigrationInterface, QueryRunner } from 'typeorm';
import { requestQuotaResetAtMs } from '../../billing/request-quota-window';
import { toLocalSqlTimestamp, toSqlTimestamp } from '../../common/utils/postgres-sql';

// Keep the migration self-contained: these are the request-level origins at
// this schema version, matching the legacy quota query it replaces.
const MANIFEST_ERROR_ORIGINS = ['config', 'policy', 'internal', 'request'] as const;
const MANIFEST_ERROR_ORIGIN_SQL_LIST = MANIFEST_ERROR_ORIGINS.map((origin) => `'${origin}'`).join(
  ', ',
);

/**
 * Replaces admission-path COUNT scans with one exact monthly counter lookup.
 *
 * The trigger increments in the same transaction that inserts the first real
 * Provider Attempt. Request.quota_counted makes retries and fallback attempts
 * idempotent. The temporary agent_messages marker keeps the initial legacy
 * seed exact if the online request backfill links a row concurrently.
 */
export class AddTenantRequestUsage1801300000000 implements MigrationInterface {
  name = 'AddTenantRequestUsage1801300000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const resetDate = new Date(requestQuotaResetAtMs());
    const resetCutoff = toLocalSqlTimestamp(resetDate);
    const resetWindow = toSqlTimestamp(resetDate);
    const storageTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const storageTimeZoneSql = storageTimeZone.replaceAll("'", "''");

    await queryRunner.query(`SET lock_timeout = '5s'`);
    try {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "tenant_request_usage" (
          "tenant_id" varchar NOT NULL,
          "window_start" timestamp NOT NULL,
          "request_count" bigint NOT NULL DEFAULT 0,
          CONSTRAINT "PK_tenant_request_usage" PRIMARY KEY ("tenant_id", "window_start"),
          CONSTRAINT "CHK_tenant_request_usage_non_negative" CHECK ("request_count" >= 0)
        )
      `);
      await queryRunner.query(
        `ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "quota_counted" boolean NOT NULL DEFAULT false`,
      );
      await queryRunner.query(
        `ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "quota_window_start" timestamp`,
      );
      await queryRunner.query(
        `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "legacy_quota_counted" boolean NOT NULL DEFAULT false`,
      );

      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION "count_tenant_request_usage"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          counted_tenant_id varchar;
          counted_window_start timestamp;
        BEGIN
          IF NEW.request_id IS NULL THEN
            RETURN NEW;
          END IF;

          IF TG_OP = 'UPDATE' THEN
            IF OLD.request_id IS NOT NULL THEN
              RETURN NEW;
            END IF;

            IF OLD.legacy_quota_counted THEN
              UPDATE "requests" r
                 SET "quota_counted" = true,
                     "quota_window_start" = COALESCE(
                       r."quota_window_start",
                       GREATEST(
                         date_trunc(
                           'month',
                           (r."timestamp" AT TIME ZONE '${storageTimeZoneSql}') AT TIME ZONE 'UTC'
                         ),
                         '${resetWindow}'::timestamp
                       )
                     )
               WHERE "id" = NEW.request_id
                 AND "quota_counted" = false;
              RETURN NEW;
            END IF;

            IF OLD.timestamp < '${resetCutoff}'::timestamp
               OR COALESCE(OLD.superseded, false)
               OR OLD.error_origin IN (${MANIFEST_ERROR_ORIGIN_SQL_LIST}) THEN
              RETURN NEW;
            END IF;
          END IF;

          UPDATE "requests" r
             SET "quota_counted" = true,
                 "quota_window_start" = COALESCE(
                   r."quota_window_start",
                   GREATEST(
                     date_trunc(
                       'month',
                       (r."timestamp" AT TIME ZONE '${storageTimeZoneSql}') AT TIME ZONE 'UTC'
                     ),
                     '${resetWindow}'::timestamp
                   )
                 )
           WHERE r."id" = NEW.request_id
             AND r."quota_counted" = false
             AND r."tenant_id" IS NOT NULL
             AND r."timestamp" >= '${resetCutoff}'::timestamp
             AND NOT EXISTS (
               SELECT 1
                 FROM "agents" a
                WHERE a."id" = r."agent_id"
                  AND a."is_playground" = true
             )
          RETURNING r."tenant_id", r."quota_window_start"
               INTO counted_tenant_id, counted_window_start;

          IF counted_tenant_id IS NULL THEN
            RETURN NEW;
          END IF;

          INSERT INTO "tenant_request_usage" ("tenant_id", "window_start", "request_count")
          VALUES (counted_tenant_id, counted_window_start, 1)
          ON CONFLICT ("tenant_id", "window_start")
          DO UPDATE SET "request_count" = "tenant_request_usage"."request_count" + 1;

          RETURN NEW;
        END;
        $$
      `);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
              FROM pg_trigger
             WHERE tgname = 'TRG_agent_messages_count_tenant_request_usage'
               AND tgrelid = 'agent_messages'::regclass
          ) THEN
            CREATE TRIGGER "TRG_agent_messages_count_tenant_request_usage"
            AFTER INSERT OR UPDATE OF "request_id" ON "agent_messages"
            FOR EACH ROW EXECUTE FUNCTION "count_tenant_request_usage"();
          END IF;
        END
        $$
      `);

      await queryRunner.query(
        `
          WITH counted AS (
            UPDATE "requests" r
               SET "quota_counted" = true,
                   "quota_window_start" = COALESCE(
                     r."quota_window_start",
                     GREATEST(
                       date_trunc(
                         'month',
                         (r."timestamp" AT TIME ZONE $3::text) AT TIME ZONE 'UTC'
                       ),
                       $2::timestamp
                     )
                   )
             WHERE r."quota_counted" = false
               AND r."tenant_id" IS NOT NULL
               AND r."timestamp" >= $1
               AND EXISTS (
                 SELECT 1 FROM "agent_messages" pa WHERE pa."request_id" = r."id"
               )
               AND NOT EXISTS (
                 SELECT 1
                   FROM "agents" a
                  WHERE a."id" = r."agent_id"
                    AND a."is_playground" = true
               )
            RETURNING r."tenant_id", r."quota_window_start"
          ), totals AS (
            SELECT "tenant_id",
                   "quota_window_start" AS "window_start",
                   COUNT(*)::bigint AS "request_count"
              FROM counted
          GROUP BY "tenant_id", "window_start"
          )
          INSERT INTO "tenant_request_usage" ("tenant_id", "window_start", "request_count")
          SELECT "tenant_id", "window_start", "request_count"
            FROM totals
          ON CONFLICT ("tenant_id", "window_start")
          DO UPDATE SET "request_count" =
            "tenant_request_usage"."request_count" + EXCLUDED."request_count"
        `,
        [resetCutoff, resetWindow, storageTimeZone],
      );

      await queryRunner.query(
        `
          WITH counted AS (
            UPDATE "agent_messages" m
               SET "legacy_quota_counted" = true
             WHERE m."legacy_quota_counted" = false
               AND m."request_id" IS NULL
               AND m."tenant_id" IS NOT NULL
               AND m."timestamp" >= $1
               AND COALESCE(m."superseded", false) = false
               AND (
                 m."error_origin" IS NULL
                 OR m."error_origin" NOT IN (${MANIFEST_ERROR_ORIGIN_SQL_LIST})
               )
               AND NOT EXISTS (
                 SELECT 1
                   FROM "agents" a
                  WHERE a."id" = m."agent_id"
                    AND a."is_playground" = true
               )
            RETURNING m."tenant_id", m."timestamp"
          ), totals AS (
            SELECT "tenant_id",
                   GREATEST(
                     date_trunc(
                       'month',
                       ("timestamp" AT TIME ZONE $3::text) AT TIME ZONE 'UTC'
                     ),
                     $2::timestamp
                   ) AS "window_start",
                   COUNT(*)::bigint AS "request_count"
              FROM counted
          GROUP BY "tenant_id", "window_start"
          )
          INSERT INTO "tenant_request_usage" ("tenant_id", "window_start", "request_count")
          SELECT "tenant_id", "window_start", "request_count"
            FROM totals
          ON CONFLICT ("tenant_id", "window_start")
          DO UPDATE SET "request_count" =
            "tenant_request_usage"."request_count" + EXCLUDED."request_count"
        `,
        [resetCutoff, resetWindow, storageTimeZone],
      );
    } finally {
      await queryRunner.query(`RESET lock_timeout`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET lock_timeout = '5s'`);
    try {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "TRG_agent_messages_count_tenant_request_usage" ON "agent_messages"`,
      );
      await queryRunner.query(`DROP FUNCTION IF EXISTS "count_tenant_request_usage"()`);
      await queryRunner.query(
        `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "legacy_quota_counted"`,
      );
      await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN IF EXISTS "quota_window_start"`);
      await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN IF EXISTS "quota_counted"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "tenant_request_usage"`);
    } finally {
      await queryRunner.query(`RESET lock_timeout`);
    }
  }
}
