import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the `provider_rate_limits` table and its index. The feature that
 * populated it was removed, so the table is cleaned up here. `IF EXISTS`
 * keeps this a no-op on fresh databases where the table was never created
 * (the original AddProviderRateLimits migration has been deleted).
 */
export class DropProviderRateLimits1791600000000 implements MigrationInterface {
  name = 'DropProviderRateLimits1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limits_connection_latest"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_rate_limits"`);
  }

  public async down(): Promise<void> {
    // No-op: the provider_rate_limits feature was removed and is not restored.
  }
}
