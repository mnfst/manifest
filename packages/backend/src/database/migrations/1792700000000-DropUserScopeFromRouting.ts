import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant-canonical scoping, step 4: remove the last user_id scope columns.
 *
 * - `agent_model_params`, `tier_assignments`, `specificity_assignments`:
 *   user_id dropped outright — their scope is the agent, tenancy derives
 *   from `agents.tenant_id`.
 * - `header_tiers`: tenant_id backfilled from the owning agent and made
 *   NOT NULL, user_id dropped.
 * - `notification_rules`: user_id dropped — rules are tenant-scoped and the
 *   recipient is resolved at send time via `tenants.owner_user_id`.
 * - `playground_runs`: user_id renamed to created_by_user_id (author audit),
 *   history index re-keyed on tenant_id.
 */
export class DropUserScopeFromRouting1792700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_model_params" DROP COLUMN IF EXISTS "user_id"`);
    await queryRunner.query(`ALTER TABLE "tier_assignments" DROP COLUMN IF EXISTS "user_id"`);
    await queryRunner.query(
      `ALTER TABLE "specificity_assignments" DROP COLUMN IF EXISTS "user_id"`,
    );

    // header_tiers: tenant_id was nullable since AddHeaderTiers — derive it
    // from the owning agent and make it authoritative. Rows pointing at a
    // deleted agent can't be re-scoped; they're unreachable config, drop them.
    await queryRunner.query(`
      UPDATE "header_tiers" h SET "tenant_id" = a."tenant_id"
      FROM "agents" a WHERE a."id" = h."agent_id" AND h."tenant_id" IS NULL
    `);
    await queryRunner.query(`DELETE FROM "header_tiers" WHERE "tenant_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "header_tiers" ALTER COLUMN "tenant_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "header_tiers" DROP COLUMN IF EXISTS "user_id"`);

    // notification_rules: tenant_id is already the scope; the (user_id,
    // agent_name) lookup index is replaced by the existing tenant-keyed one.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_rules_user_agent"`);
    await queryRunner.query(`ALTER TABLE "notification_rules" DROP COLUMN IF EXISTS "user_id"`);

    // oauth_pending_flows: transient PKCE flow rows are tenant-scoped now —
    // rename the column so the schema matches what the store writes.
    await queryRunner.query(
      `ALTER TABLE "oauth_pending_flows" RENAME COLUMN "user_id" TO "tenant_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_oauth_pending_flows_agent_user"`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_oauth_pending_flows_agent_tenant"
      ON "oauth_pending_flows" ("provider", "agent_id", "tenant_id", "created_at" DESC)
    `);

    // playground_runs: tenant owns the history, the user is just the author.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playground_runs_user_agent_created"`);
    await queryRunner.query(
      `ALTER TABLE "playground_runs" RENAME COLUMN "user_id" TO "created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playground_runs" ALTER COLUMN "created_by_user_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_playground_runs_tenant_agent_created"
      ON "playground_runs" ("tenant_id", "agent_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_oauth_pending_flows_agent_tenant"`);
    await queryRunner.query(
      `ALTER TABLE "oauth_pending_flows" RENAME COLUMN "tenant_id" TO "user_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_oauth_pending_flows_agent_user" ` +
        `ON "oauth_pending_flows" ("provider", "agent_id", "user_id", "created_at" DESC)`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playground_runs_tenant_agent_created"`);
    await queryRunner.query(
      `ALTER TABLE "playground_runs" RENAME COLUMN "created_by_user_id" TO "user_id"`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_playground_runs_user_agent_created"
      ON "playground_runs" ("user_id", "agent_id", "created_at" DESC)
    `);

    // Best-effort dev rollback: re-add the columns nullable and backfill from
    // the tenant owner so the previous release can boot.
    await queryRunner.query(
      `ALTER TABLE "notification_rules" ADD COLUMN IF NOT EXISTS "user_id" varchar`,
    );
    await queryRunner.query(`
      UPDATE "notification_rules" r SET "user_id" = t."owner_user_id"
      FROM "tenants" t WHERE t."id" = r."tenant_id" AND r."user_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_rules_user_agent"
      ON "notification_rules" ("user_id", "agent_name")
    `);

    await queryRunner.query(
      `ALTER TABLE "header_tiers" ADD COLUMN IF NOT EXISTS "user_id" varchar`,
    );
    await queryRunner.query(`
      UPDATE "header_tiers" h SET "user_id" = t."owner_user_id"
      FROM "tenants" t WHERE t."id" = h."tenant_id" AND h."user_id" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "header_tiers" ALTER COLUMN "tenant_id" DROP NOT NULL`);

    for (const table of ['specificity_assignments', 'tier_assignments', 'agent_model_params']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "user_id" varchar`);
      await queryRunner.query(`
        UPDATE "${table}" x SET "user_id" = t."owner_user_id"
        FROM "agents" a
        JOIN "tenants" t ON t."id" = a."tenant_id"
        WHERE a."id" = x."agent_id" AND x."user_id" IS NULL
      `);
    }
  }
}
