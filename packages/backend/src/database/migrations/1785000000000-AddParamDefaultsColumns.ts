import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a nullable `param_defaults` JSONB column to tier_assignments and
 * specificity_assignments. Stores per-assignment outbound request body
 * defaults (e.g. DeepSeek's `thinking: { type: 'disabled' }`) merged into
 * the provider request when no client value is present.
 */
export class AddParamDefaultsColumns1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['tier_assignments', 'specificity_assignments']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "param_defaults" jsonb DEFAULT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['tier_assignments', 'specificity_assignments']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "param_defaults"`);
    }
  }
}
