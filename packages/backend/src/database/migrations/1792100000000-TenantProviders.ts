import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant-canonical scoping, step 2: provider connections belong to the tenant.
 *
 * `user_providers` becomes `tenant_providers`: rows gain a NOT NULL
 * `tenant_id` (backfilled through `tenants.owner_user_id`), the authoritative
 * `user_id` column is demoted to a nullable `created_by_user_id` audit column,
 * and the uniqueness key moves from (user_id, …) to (tenant_id, …). The
 * `agent_enabled_providers` junction column follows the rename.
 *
 * Rows whose user has no tenant cannot be re-scoped. The migration aborts so
 * the operator can inspect them; set MANIFEST_MIGRATION_FORCE=1 to delete the
 * orphans instead (a provider row is unreachable without a tenant anyway).
 */
export class TenantProviders1792100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "tenant_id" varchar`,
    );

    await queryRunner.query(`
      UPDATE "user_providers" up SET "tenant_id" = t."id"
      FROM "tenants" t
      WHERE t."owner_user_id" = up."user_id" AND up."tenant_id" IS NULL
    `);

    const orphans: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM "user_providers" WHERE "tenant_id" IS NULL`,
    );
    const orphanCount = Number(orphans[0]?.count ?? 0);
    if (orphanCount > 0) {
      if (process.env.MANIFEST_MIGRATION_FORCE === '1') {
        await queryRunner.query(`DELETE FROM "user_providers" WHERE "tenant_id" IS NULL`);
      } else {
        throw new Error(
          `TenantProviders migration: ${orphanCount} user_providers row(s) reference a user ` +
            `with no tenant and cannot be re-scoped. Inspect them (SELECT * FROM user_providers ` +
            `WHERE tenant_id IS NULL) or re-run with MANIFEST_MIGRATION_FORCE=1 to delete them.`,
        );
      }
    }

    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "tenant_id" SET NOT NULL`);

    // Demote user_id to a nullable, non-authoritative audit column.
    await queryRunner.query(
      `ALTER TABLE "user_providers" RENAME COLUMN "user_id" TO "created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ALTER COLUMN "created_by_user_id" DROP NOT NULL`,
    );

    // Move the uniqueness key from the user to the tenant.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_providers_tenant_provider_auth_label"
      ON "user_providers" ("tenant_id", "provider", "auth_type", LOWER("label"))
    `);

    await queryRunner.query(`ALTER TABLE "user_providers" RENAME TO "tenant_providers"`);

    // The junction column keeps referencing the same rows; rename it (and its
    // identifiers) so nothing in the schema still says "user provider".
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME COLUMN "user_provider_id" TO "tenant_provider_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_agent_enabled_providers_provider" RENAME TO "IDX_agent_enabled_providers_tenant_provider"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_agent_enabled_providers_tenant_provider" RENAME TO "IDX_agent_enabled_providers_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME COLUMN "tenant_provider_id" TO "user_provider_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tenant_providers" RENAME TO "user_providers"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tenant_providers_tenant_provider_auth_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" RENAME COLUMN "created_by_user_id" TO "user_id"`,
    );
    // Restore authoritative user_id semantics: rows whose audit column was
    // null get the tenant owner back, and NOT NULL is re-imposed only when
    // every row could be mapped (ownerless tenants leave it nullable rather
    // than failing the rollback).
    await queryRunner.query(`
      UPDATE "user_providers" up SET "user_id" = t."owner_user_id"
      FROM "tenants" t WHERE t."id" = up."tenant_id" AND up."user_id" IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM "user_providers" WHERE "user_id" IS NULL) THEN
          ALTER TABLE "user_providers" ALTER COLUMN "user_id" SET NOT NULL;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_providers_user_provider_auth_label"
      ON "user_providers" ("user_id", "provider", "auth_type", LOWER("label"))
    `);
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "tenant_id"`);
  }
}
