import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `requests.recovered_by_key_rotation` — the request-level marker for a
 * Request that SUCCEEDED after a same-model key-rotation retry (key A failed,
 * key B succeeded). Consumed by the "Recovered by key rotation" outcome
 * category (docs/glossary.md), which ranks after Auto-fix and before fallback.
 */
export class AddRequestRecoveredByKeyRotation1801810000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "requests"
      ADD COLUMN IF NOT EXISTS "recovered_by_key_rotation" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "requests"
      DROP COLUMN IF EXISTS "recovered_by_key_rotation"
    `);
  }
}
