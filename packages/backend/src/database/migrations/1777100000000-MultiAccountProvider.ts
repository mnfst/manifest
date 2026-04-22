import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-account provider support — Slice 1: data layer only.
 *
 * - Adds `account_label` (human label) and `is_default` to `user_providers`.
 * - Backfills existing rows to `account_label='default'`, `is_default=true`.
 * - Replaces the old unique index on `(agent_id, provider, auth_type)` with a
 *   partial unique index that only covers active rows, so multiple accounts for
 *   the same provider can coexist (inactive ones don't conflict).
 * - Adds a partial unique index enforcing at most one active default per
 *   `(agent_id, provider, auth_type)`.
 * - Adds nullable `override_provider_id` to `tier_assignments` and
 *   `specificity_assignments` (references `user_providers.id`).
 */
export class MultiAccountProvider1777100000000 implements MigrationInterface {
  name = 'MultiAccountProvider1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- user_providers: new columns ---
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN "account_label" character varying NOT NULL DEFAULT 'default'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN "is_default" boolean NOT NULL DEFAULT true`,
    );

    // Backfill existing rows (should already match the defaults, but be explicit)
    await queryRunner.query(
      `UPDATE "user_providers" SET "account_label" = 'default', "is_default" = true WHERE "account_label" != 'default' OR "is_default" != true`,
    );

    // Drop the old unique index on (agent_id, provider, auth_type)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth"`);

    // Partial unique: active rows must have unique (agent_id, provider, auth_type, account_label)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_active_label_unique" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type", "account_label") ` +
        `WHERE "is_active" = true`,
    );

    // Partial unique: at most one active default per (agent_id, provider, auth_type)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_active_default_unique" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type") ` +
        `WHERE "is_active" = true AND "is_default" = true`,
    );

    // --- tier_assignments: override_provider_id ---
    await queryRunner.query(
      `ALTER TABLE "tier_assignments" ADD COLUMN "override_provider_id" character varying`,
    );

    // --- specificity_assignments: override_provider_id ---
    await queryRunner.query(
      `ALTER TABLE "specificity_assignments" ADD COLUMN "override_provider_id" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "specificity_assignments" DROP COLUMN "override_provider_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tier_assignments" DROP COLUMN "override_provider_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_active_default_unique"`);
    await queryRunner.query(`DROP INDEX "IDX_user_providers_active_label_unique"`);
    // Before restoring the strict (non-partial) unique index, we must
    // ensure at most ONE row per (agent_id, provider, auth_type) across
    // ALL rows — active and inactive alike.  Duplicate inactive rows are
    // just as fatal for a global UNIQUE index as active ones.
    //
    // This is destructive: extra rows are deleted.  The survivor is chosen
    // deterministically — prefer the default account, then the active one,
    // then the earliest connected, then the lowest id.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "agent_id", "provider", "auth_type"
            ORDER BY "is_default" DESC, "is_active" DESC, "connected_at" ASC, "id" ASC
          ) AS rn
        FROM "user_providers"
      )
      DELETE FROM "user_providers" u
      USING ranked r
      WHERE u."id" = r."id"
        AND r.rn > 1
    `);
    // Restore the original (non-partial) unique index
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type")`,
    );
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN "is_default"`);
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN "account_label"`);
  }
}
