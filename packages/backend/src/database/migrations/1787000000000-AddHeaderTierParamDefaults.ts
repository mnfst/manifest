import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a nullable `param_defaults` JSONB column to header_tiers, mirroring
 * the column already present on tier_assignments and specificity_assignments
 * so the same param-defaults storage and merge work uniformly across all
 * three routing surfaces.
 */
export class AddHeaderTierParamDefaults1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "header_tiers" ADD COLUMN IF NOT EXISTS "param_defaults" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "header_tiers" DROP COLUMN IF EXISTS "param_defaults"`);
  }
}
