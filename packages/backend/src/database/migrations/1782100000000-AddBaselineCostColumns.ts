import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBaselineCostColumns1782100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "baseline_model_id" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "baseline_cost_usd" decimal(10,6) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "baseline_cost_usd"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "baseline_model_id"`);
  }
}
