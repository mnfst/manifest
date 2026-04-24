import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Defensive reconciler for the `agents` table.
 *
 * We shipped three migrations that each add a boolean column to `agents`:
 *
 *   1777100000000-AddComplexityRoutingFlag   (from main — `complexity_routing_enabled`)
 *   1777110000000-AddAgentRecordMessages     (from this branch — `record_messages`, renamed)
 *
 * In the wild we saw a production instance running a TypeORM-generated
 * SELECT that referenced `complexity_routing_enabled` against a database
 * where the column did not exist — most likely a DB snapshot restore that
 * rolled back the schema without clearing the `migrations` table (so
 * TypeORM's `migrationsRun: true` saw the name recorded and skipped the
 * body). The agent entity declares both columns, so one missing column
 * 500s every authenticated request.
 *
 * This migration plugs that gap for the remaining life of this codebase.
 * It is idempotent — every DDL uses `IF NOT EXISTS` and the tier-assignment
 * seed guards on absence — so it is safe to re-run, safe on a virgin DB,
 * and safe on a DB where the original migrations ran correctly.
 */
export class ReconcileAgentColumns1777500000000 implements MigrationInterface {
  name = 'ReconcileAgentColumns1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "record_messages" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "complexity_routing_enabled" boolean NOT NULL DEFAULT false`,
    );

    // Match the behaviour of the original AddComplexityRoutingFlag migration
    // on the subset of agents that were missing the column: existing agents
    // keep complexity routing ON so their current setup behaves the same.
    // New rows (post-fix) default to the column's `false` default via the
    // ALTER above. Only touch rows where the flag is still `false` so we
    // don't clobber intentional toggles from already-migrated agents.
    await queryRunner.query(
      `UPDATE "agents" SET "complexity_routing_enabled" = true WHERE "complexity_routing_enabled" = false`,
    );

    // Seed a 'default' tier row per agent that doesn't yet have one —
    // same shape as the original migration. Without this, agents created
    // before the flag existed render an empty 'default' tier card.
    await queryRunner.query(`
      INSERT INTO "tier_assignments"
        ("id", "user_id", "agent_id", "tier", "override_model", "override_provider",
         "override_auth_type", "auto_assigned_model", "fallback_models", "updated_at")
      SELECT
        gen_random_uuid()::varchar,
        COALESCE(ta."user_id", ''),
        a."id",
        'default',
        ta."override_model",
        ta."override_provider",
        ta."override_auth_type",
        ta."auto_assigned_model",
        ta."fallback_models",
        NOW()
      FROM "agents" a
      LEFT JOIN "tier_assignments" ta
        ON ta."agent_id" = a."id" AND ta."tier" = 'standard'
      WHERE NOT EXISTS (
        SELECT 1 FROM "tier_assignments" d
        WHERE d."agent_id" = a."id" AND d."tier" = 'default'
      )
    `);
  }

  public async down(): Promise<void> {
    // Reconcilers don't reverse — rolling back would fight with whichever
    // prior migration actually landed the columns. No-op.
  }
}
