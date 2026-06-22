import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Canonical covering index for the dashboard aggregations — the Overview summary
 * cards, the token/cost/message timeseries, cost-by-model, and the per-provider
 * analytics. They all scan (tenant_id, timestamp) and read
 * model/provider/auth_type/input_tokens/output_tokens/cost_usd. With every
 * column in the index they run as index-only scans (no heap access); combined
 * with the agent_messages autovacuum tuning that keeps the visibility map fresh,
 * the dashboard aggregations stay off the heap entirely.
 *
 * Two things this fixes:
 *   1. The index was only present on the hosted database (added out-of-band),
 *      so self-hosted / fresh installs had no covering index and sequentially
 *      scanned every dashboard aggregation. Codifying it here gives every
 *      install the index-only path.
 *   2. The hosted copy was missing `model`, so cost-by-model still hit the heap.
 *      Adding `model` makes that aggregation index-only too.
 *
 * DROP-then-CREATE so any pre-existing out-of-band copy is replaced with the
 * model-inclusive definition. Both run CONCURRENTLY (so `transaction = false`):
 * the blocking form rebuilds a multi-hundred-MB index under ACCESS EXCLUSIVE and
 * deadlocked against live agent_messages writes during the deploy. CONCURRENTLY
 * builds it in the background under SHARE UPDATE EXCLUSIVE, which does not
 * conflict with writes — no stall, no deadlock.
 */
export class AddDashboardCoveringIndex1793200000000 implements MigrationInterface {
  name = 'AddDashboardCoveringIndex1793200000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_provider_usage"`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_provider_usage" ON "agent_messages" ("tenant_id", "timestamp") INCLUDE ("model", "provider", "auth_type", "input_tokens", "output_tokens", "cost_usd")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the prior (model-less) covering definition.
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_provider_usage"`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_provider_usage" ON "agent_messages" ("tenant_id", "timestamp") INCLUDE ("provider", "auth_type", "input_tokens", "output_tokens", "cost_usd")`,
    );
  }
}
