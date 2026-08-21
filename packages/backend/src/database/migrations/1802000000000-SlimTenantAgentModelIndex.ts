import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the dedup composite index with a slimmer tenant+agent+model index.
 *
 * `IDX_agent_messages_tenant_agent_model_status_ts`
 * (`tenant_id, agent_id, model, status, timestamp`) was added (1790200000000)
 * for the per-completion success-dedup lookup, which has since been removed.
 * The planner still picks it for the per-agent "cost by model" read in
 * `agent-analytics.service.ts` (`WHERE tenant_id + agent_id + model IS NOT NULL
 * GROUP BY model`), which only needs the leading three columns. The trailing
 * `status` and `timestamp` columns are vestigial, so the index carries dead
 * weight on the hottest write path (every insert maintains it).
 *
 * Replaced with `IDX_agent_messages_tenant_agent_id_model`
 * (`tenant_id, agent_id, model`), which serves the same read with a narrower
 * key and benefits from B-tree deduplication on repeated (tenant, agent, model)
 * tuples. Named with `agent_id` to avoid colliding with the existing
 * `IDX_agent_messages_tenant_agent_model` (tenant_id, agent_name, model).
 *
 * Build-new-then-drop CONCURRENTLY so a usable index always exists and no
 * ACCESS EXCLUSIVE lock is taken against live writes. The new key is a strict
 * prefix of the old, so no query loses index coverage during the swap.
 */
export class SlimTenantAgentModelIndex1802000000000 implements MigrationInterface {
  name = 'SlimTenantAgentModelIndex1802000000000';
  transaction = false;

  private static readonly OLD_INDEX = 'IDX_agent_messages_tenant_agent_model_status_ts';
  private static readonly NEW_INDEX = 'IDX_agent_messages_tenant_agent_id_model';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { OLD_INDEX, NEW_INDEX } = SlimTenantAgentModelIndex1802000000000;
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${NEW_INDEX}" ON "agent_messages" ("tenant_id", "agent_id", "model")`,
    );
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${OLD_INDEX}"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const { OLD_INDEX, NEW_INDEX } = SlimTenantAgentModelIndex1802000000000;
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${OLD_INDEX}" ON "agent_messages" ("tenant_id", "agent_id", "model", "status", "timestamp")`,
    );
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${NEW_INDEX}"`);
  }
}
