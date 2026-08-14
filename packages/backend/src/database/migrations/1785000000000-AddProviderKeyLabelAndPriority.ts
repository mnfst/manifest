import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-key support per (agent, provider, auth_type).
 *
 * Adds `label` ('Default' for existing rows) and `priority` (0 for existing
 * rows) to user_providers, then swaps the unique index from
 * (agent_id, provider, auth_type) to (agent_id, provider, auth_type,
 * LOWER(label)) so users can attach up to 5 labeled keys per provider.
 *
 * The pinned key for an override / fallback is stored inside the jsonb
 * `override_route` / `fallback_routes` columns (added in
 * 1783000000000-AddModelRouteColumns) as `keyLabel`. No new columns on
 * tier_assignments / specificity_assignments are needed.
 */
export class AddProviderKeyLabelAndPriority1785000000000 implements MigrationInterface {
  name = 'AddProviderKeyLabelAndPriority1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "label" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "priority" integer`,
    );

    await queryRunner.query(
      `UPDATE "user_providers" SET "label" = 'Default' WHERE "label" IS NULL`,
    );
    await queryRunner.query(`UPDATE "user_providers" SET "priority" = 0 WHERE "priority" IS NULL`);

    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "label" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "priority" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "priority" SET DEFAULT 0`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);
    // Before recreating the stricter pre-multi-key unique index, dedup any
    // multi-key rows the user added while the new index was active. Keep
    // the lowest-priority row per (agent, provider, auth_type) tuple — it's
    // the one that resolves as the legacy primary anyway. Without this
    // step, the CREATE UNIQUE INDEX below would fail with a duplicate-key
    // error on any agent that has 2+ labeled keys for one provider.
    await queryRunner.query(
      `DELETE FROM "user_providers" a USING "user_providers" b ` +
        `WHERE a.agent_id = b.agent_id ` +
        `AND a.provider = b.provider ` +
        `AND a.auth_type = b.auth_type ` +
        `AND a.priority > b.priority`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type")`,
    );
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "priority"`);
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "label"`);
  }
}
