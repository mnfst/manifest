import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial index covering only error-status rows. Error/failure dashboards and
 * the recent-error lookup filter agent_messages by (tenant_id, timestamp) AND
 * status IN ('error','fallback_error','rate_limited'). Errors are a tiny
 * fraction of total rows, so a partial index stays small and lets those queries
 * skip the vast majority of healthy ('ok') messages. Mirrors the partial-index
 * shape used by IDX_agent_messages_recorded / IDX_agent_messages_miscategorized.
 */
export class AddErrorsPartialIndex1790300000000 implements MigrationInterface {
  name = 'AddErrorsPartialIndex1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_errors" ON "agent_messages" ("tenant_id", "timestamp") WHERE "status" IN ('error', 'fallback_error', 'rate_limited')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_errors"`);
  }
}
