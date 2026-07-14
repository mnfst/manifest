import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces the request/attempt boundary without rewriting historical data in
 * the deploy path. History is linked later by the resumable boot backfill.
 *
 * This migration runs outside a transaction because the request_id index is
 * built CONCURRENTLY. Every statement is restart-safe so a process failure
 * between statements can be retried.
 */
export class AddRequestsAndProviderAttempts1801000000000 implements MigrationInterface {
  name = 'AddRequestsAndProviderAttempts1801000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fail the deploy attempt instead of queueing an ACCESS EXCLUSIVE rename
    // behind a long Cloud query and then blocking newer traffic behind us.
    await queryRunner.query(`SET lock_timeout = '5s'`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "requests" (
        "id" varchar NOT NULL,
        "tenant_id" varchar,
        "agent_id" varchar,
        "user_id" varchar,
        "agent_name" varchar,
        "trace_id" varchar,
        "session_key" varchar,
        "session_id" varchar,
        "timestamp" timestamp NOT NULL,
        "duration_ms" integer,
        "status" varchar NOT NULL,
        "error_message" varchar,
        "error_http_status" integer,
        "error_code" varchar(8),
        "error_origin" varchar,
        "error_class" varchar,
        "requested_model" varchar,
        "caller_attribution" text,
        "request_headers" text,
        "request_params" jsonb,
        "feedback_rating" varchar,
        "feedback_tags" varchar,
        "feedback_details" text,
        CONSTRAINT "PK_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.provider_attempts') IS NULL
           AND to_regclass('public.agent_messages') IS NOT NULL THEN
          ALTER TABLE "agent_messages" RENAME TO "provider_attempts";
        END IF;
      END $$
    `);
    await queryRunner.query(
      `ALTER TABLE "provider_attempts" ADD COLUMN IF NOT EXISTS "request_id" varchar`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_provider_attempts_request'
        ) THEN
          ALTER TABLE "provider_attempts"
            ADD CONSTRAINT "FK_provider_attempts_request"
            FOREIGN KEY ("request_id") REFERENCES "requests"("id")
            ON DELETE CASCADE NOT VALID;
        END IF;
      END $$
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_requests_tenant_agent_timestamp" ON "requests" ("tenant_id", "agent_id", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_requests_tenant_timestamp" ON "requests" ("tenant_id", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_requests_tenant_trace" ON "requests" ("tenant_id", "trace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_requests_tenant_status_timestamp" ON "requests" ("tenant_id", "status", "timestamp")`,
    );
    const requestIndex = (await queryRunner.query(`
      SELECT i.indisvalid AS valid
      FROM pg_class c
      JOIN pg_index i ON i.indexrelid = c.oid
      WHERE c.relname = 'IDX_provider_attempts_request_id'
    `)) as Array<{ valid: boolean }>;
    // PostgreSQL leaves an invalid shell behind when CREATE INDEX
    // CONCURRENTLY is interrupted. IF NOT EXISTS would treat that shell as a
    // usable index, so remove it before retrying the build.
    if (requestIndex?.[0]?.valid === false) {
      await queryRunner.query(
        `DROP INDEX CONCURRENTLY IF EXISTS "IDX_provider_attempts_request_id"`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_provider_attempts_request_id" ON "provider_attempts" ("request_id") WHERE "request_id" IS NOT NULL`,
    );
    await queryRunner.query(`RESET lock_timeout`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_provider_attempts_request_id"`);
    await queryRunner.query(
      `ALTER TABLE "provider_attempts" DROP CONSTRAINT IF EXISTS "FK_provider_attempts_request"`,
    );
    await queryRunner.query(`ALTER TABLE "provider_attempts" DROP COLUMN IF EXISTS "request_id"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.agent_messages') IS NULL
           AND to_regclass('public.provider_attempts') IS NOT NULL THEN
          ALTER TABLE "provider_attempts" RENAME TO "agent_messages";
        END IF;
      END $$
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "requests"`);
  }
}
