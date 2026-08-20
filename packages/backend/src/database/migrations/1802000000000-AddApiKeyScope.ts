import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `scope` column to `api_keys` so a single key table can carry both
 * owner (dashboard) keys and AI-admin (`mnfst_admin_ai_*`) keys. The new
 * column defaults to `owner`, so every existing row keeps its prior
 * authorization (full `/api/v1/*` surface) and nothing else changes. The
 * AdminAiGuard reads this column to authorize the scoped `/api/v1/admin`
 * surface.
 */
export class AddApiKeyScope1802000000000 implements MigrationInterface {
  name = 'AddApiKeyScope1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Catalog-only ALTER; bound the lock wait so a deploy queues behind a long
    // read instead of blocking the table indefinitely.
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "scope" varchar NOT NULL DEFAULT 'owner'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "scope"`);
  }
}
