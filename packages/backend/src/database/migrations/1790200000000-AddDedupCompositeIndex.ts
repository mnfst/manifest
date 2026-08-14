import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a composite index for the per-completion success-dedup lookup in
 * ProxyMessageDedup.findExistingSuccessMessage(), which filters
 * (tenant_id, agent_id, model, status='ok') and orders by timestamp DESC,
 * taking the 10 most recent rows. The leading columns match the equality
 * filters and the trailing timestamp lets the planner satisfy the ORDER BY +
 * LIMIT without a sort. Mirrors the entity @Index on AgentMessage.
 */
export class AddDedupCompositeIndex1790200000000 implements MigrationInterface {
  name = 'AddDedupCompositeIndex1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_agent_model_status_ts" ON "agent_messages" ("tenant_id", "agent_id", "model", "status", "timestamp")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agent_messages_tenant_agent_model_status_ts"`,
    );
  }
}
