import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the unused savings/baseline columns. The dashboard no longer displays
 * a savings metric, so the per-message baseline cost snapshot and the per-agent
 * baseline model are dead data. Uses `IF EXISTS` so the migration is a no-op on
 * databases that never had the columns (the original Add migrations were removed).
 */
export class DropSavingsBaselineColumns1791700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN IF EXISTS "savings_baseline_model"`);
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "baseline_cost_usd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "baseline_model_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "savings_baseline_model" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "baseline_model_id" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "baseline_cost_usd" decimal(10,6) DEFAULT NULL`,
    );
  }
}
