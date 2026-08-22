import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a one-way `key_hash` column to `tenant_providers` so an admin can
 * verify a posted provider key matches the stored credential without the API
 * ever returning the raw secret. Mirrors `api_keys.key_hash`. The hash is
 * computed from the raw key at connect/update time (see ProviderService
 * upsert paths); existing rows without a key leave it NULL.
 */
export class AddTenantProviderKeyHash1802000001000 implements MigrationInterface {
  name = 'AddTenantProviderKeyHash1802000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(
      `ALTER TABLE "tenant_providers" ADD COLUMN IF NOT EXISTS "key_hash" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Session-scoped for --transaction-none reverts (SET LOCAL would not
    // persist); reset afterwards. See AddApiKeyScope.down for rationale.
    await queryRunner.query(`SET lock_timeout = '5s'`);
    await queryRunner.query(`ALTER TABLE "tenant_providers" DROP COLUMN IF EXISTS "key_hash"`);
    await queryRunner.query(`RESET lock_timeout`);
  }
}
