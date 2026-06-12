import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant-canonical scoping, step 1: make the user→tenant link explicit.
 *
 * Until now the link was implicit — `tenants.name` stored the Better Auth
 * user id and every resolution did `WHERE tenants.name = :userId`. This adds
 * a dedicated `owner_user_id` column so `name` can stop doubling as a foreign
 * key. The backfill copies `name` unconditionally: by construction every
 * tenant's name IS the id of the user that owns it (the seeder, the lazy
 * onboarding path, and the self-hosted synthetic `'local'` user all write
 * `name = userId`), so the copy preserves the exact resolution semantics —
 * including self-hosted installs where `'local'` never appears in the Better
 * Auth `user` table.
 */
export class TenantOwnerColumn1792000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "owner_user_id" varchar
    `);

    await queryRunner.query(`
      UPDATE "tenants" SET "owner_user_id" = "name" WHERE "owner_user_id" IS NULL
    `);

    // Nullable on purpose: future tenants may exist without an owning user
    // (e.g. team workspaces). Uniqueness only applies where an owner is set.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenants_owner_user"
      ON "tenants" ("owner_user_id") WHERE "owner_user_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_tenants_owner_user"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "owner_user_id"`);
  }
}
