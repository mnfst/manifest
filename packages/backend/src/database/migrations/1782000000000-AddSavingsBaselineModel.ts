import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavingsBaselineModel1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "savings_baseline_model" varchar DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "savings_baseline_model"`);
  }
}
