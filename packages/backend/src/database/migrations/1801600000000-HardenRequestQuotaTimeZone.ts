import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  REQUEST_QUOTA_CONFIG_TABLE,
  REQUEST_USAGE_CUTOVER_STATE,
} from '../../billing/request-quota-window';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';

const MANIFEST_ERROR_ORIGINS = ['config', 'policy', 'internal', 'request'] as const;
const MANIFEST_ERROR_ORIGIN_SQL_LIST = MANIFEST_ERROR_ORIGINS.map((origin) => `'${origin}'`).join(
  ', ',
);

interface InstalledCounterDefinition {
  storageTimeZone: string;
  resetCutoff: string;
  resetWindow: string;
}

interface InstalledResetWindow {
  resetCutoff: string;
  resetWindow: string;
}

function sqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function parseInstalledResetWindow(definition: string): InstalledResetWindow {
  const timestampLiterals = [...definition.matchAll(/'([^']+)'::timestamp/g)].map(
    (match) => match[1],
  );

  if (timestampLiterals.length < 2) {
    throw new Error('Could not read request quota reset window from installed trigger');
  }

  return {
    resetCutoff: timestampLiterals[0],
    resetWindow: timestampLiterals[1],
  };
}

function parseInstalledCounterDefinition(definition: string): InstalledCounterDefinition {
  const storageTimeZone = definition.match(
    /(?:OLD|NEW|prior|r)\."timestamp"\s+AT TIME ZONE '([^']+)'/,
  )?.[1];
  if (!storageTimeZone) {
    throw new Error('Could not read request quota timezone from installed trigger');
  }
  return { storageTimeZone, ...parseInstalledResetWindow(definition) };
}

function counterFunctionSql(
  resetCutoff: string,
  resetWindow: string,
  storageTimeZoneExpression: string,
  loadStorageTimeZone: boolean,
): string {
  const storageTimeZoneDeclaration = loadStorageTimeZone ? 'request_storage_time_zone text;' : '';
  const storageTimeZoneSetup = loadStorageTimeZone
    ? `
          SELECT "storage_time_zone"
            INTO request_storage_time_zone
            FROM "${REQUEST_QUOTA_CONFIG_TABLE}"
           WHERE "id" = 1;

          IF request_storage_time_zone IS NULL THEN
            RAISE EXCEPTION 'Missing request quota storage timezone';
          END IF;
`
    : '';

  return `
    CREATE OR REPLACE FUNCTION "count_tenant_request_usage"()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      counter_cutover_at timestamp;
      counted_tenant_id varchar;
      counted_window_start timestamp;
      ${storageTimeZoneDeclaration}
    BEGIN
      IF NEW.request_id IS NULL THEN
        RETURN NEW;
      END IF;
${storageTimeZoneSetup}
      SELECT "completed_at"
        INTO counter_cutover_at
        FROM "backfill_state"
       WHERE "name" = '${REQUEST_USAGE_CUTOVER_STATE}';

      IF counter_cutover_at IS NULL THEN
        RETURN NEW;
      END IF;

      IF TG_OP = 'UPDATE' THEN
        IF OLD.request_id IS NOT NULL THEN
          RETURN NEW;
        END IF;

        IF (OLD."timestamp" AT TIME ZONE ${storageTimeZoneExpression}) AT TIME ZONE 'UTC'
             < counter_cutover_at
           OR COALESCE(OLD.superseded, false)
           OR OLD.error_origin IN (${MANIFEST_ERROR_ORIGIN_SQL_LIST}) THEN
          RETURN NEW;
        END IF;
      ELSIF COALESCE(NEW.superseded, false)
         OR NEW.error_origin IN (${MANIFEST_ERROR_ORIGIN_SQL_LIST}) THEN
        RETURN NEW;
      END IF;

      IF (NEW."timestamp" AT TIME ZONE ${storageTimeZoneExpression}) AT TIME ZONE 'UTC'
           < counter_cutover_at THEN
        RETURN NEW;
      END IF;

      IF EXISTS (
        SELECT 1
          FROM "agent_messages" prior
         WHERE prior."request_id" = NEW.request_id
           AND prior."id" <> NEW.id
           AND (
             (prior."timestamp" AT TIME ZONE ${storageTimeZoneExpression}) AT TIME ZONE 'UTC'
           ) < counter_cutover_at
           AND (
             prior."error_origin" IS NULL
             OR prior."error_origin" NOT IN (${MANIFEST_ERROR_ORIGIN_SQL_LIST})
           )
      ) THEN
        UPDATE "requests"
           SET "quota_counted" = true
         WHERE "id" = NEW.request_id
           AND "quota_counted" = false;
        RETURN NEW;
      END IF;

      UPDATE "requests" r
         SET "quota_counted" = true
       WHERE r."id" = NEW.request_id
         AND r."quota_counted" = false
         AND r."tenant_id" IS NOT NULL
         AND r."timestamp" >= '${sqlLiteral(resetCutoff)}'::timestamp
         AND NOT EXISTS (
           SELECT 1
             FROM "agents" a
            WHERE a."id" = r."agent_id"
              AND a."is_playground" = true
         )
      RETURNING
        r."tenant_id",
        GREATEST(
          date_trunc(
            'month',
            (r."timestamp" AT TIME ZONE ${storageTimeZoneExpression}) AT TIME ZONE 'UTC'
          ),
          '${sqlLiteral(resetWindow)}'::timestamp
        )
           INTO counted_tenant_id, counted_window_start;

      IF counted_tenant_id IS NULL THEN
        RETURN NEW;
      END IF;

      INSERT INTO "tenant_request_usage" (
        "tenant_id",
        "window_start",
        "request_count",
        "baseline_counted"
      )
      VALUES (
        counted_tenant_id,
        counted_window_start,
        1,
        counted_window_start >= counter_cutover_at
      )
      ON CONFLICT ("tenant_id", "window_start")
      DO UPDATE SET "request_count" = "tenant_request_usage"."request_count" + 1;

      RETURN NEW;
    END;
    $$
  `;
}

async function readInstalledFunctionDefinition(queryRunner: QueryRunner): Promise<string> {
  const rows: Array<{ definition: string | null }> = await queryRunner.query(`
    SELECT pg_get_functiondef(
             to_regprocedure('"count_tenant_request_usage"()')
           ) AS "definition"
  `);
  const definition = rows[0]?.definition;
  if (!definition) {
    throw new Error('Missing installed request quota counter function');
  }
  return definition;
}

export class HardenRequestQuotaTimeZone1801600000000 implements MigrationInterface {
  name = 'HardenRequestQuotaTimeZone1801600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (isSelfHosted()) return;

    const installed = parseInstalledCounterDefinition(
      await readInstalledFunctionDefinition(queryRunner),
    );

    await queryRunner.query(`
      CREATE TABLE "${REQUEST_QUOTA_CONFIG_TABLE}" (
        "id" smallint NOT NULL,
        "storage_time_zone" text NOT NULL,
        CONSTRAINT "PK_request_quota_config" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_request_quota_config_singleton" CHECK ("id" = 1)
      )
    `);
    await queryRunner.query(
      `INSERT INTO "${REQUEST_QUOTA_CONFIG_TABLE}" ("id", "storage_time_zone") VALUES (1, $1)`,
      [installed.storageTimeZone],
    );
    await queryRunner.query(
      counterFunctionSql(
        installed.resetCutoff,
        installed.resetWindow,
        'request_storage_time_zone',
        true,
      ),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (isSelfHosted()) return;

    const installed = parseInstalledResetWindow(await readInstalledFunctionDefinition(queryRunner));
    const rows: Array<{ storage_time_zone: string | null }> = await queryRunner.query(
      `SELECT "storage_time_zone" FROM "${REQUEST_QUOTA_CONFIG_TABLE}" WHERE "id" = 1`,
    );
    const storageTimeZone = rows[0]?.storage_time_zone;
    if (!storageTimeZone) {
      throw new Error('Missing request quota storage timezone');
    }

    await queryRunner.query(
      counterFunctionSql(
        installed.resetCutoff,
        installed.resetWindow,
        `'${sqlLiteral(storageTimeZone)}'`,
        false,
      ),
    );
    await queryRunner.query(`DROP TABLE "${REQUEST_QUOTA_CONFIG_TABLE}"`);
  }
}
