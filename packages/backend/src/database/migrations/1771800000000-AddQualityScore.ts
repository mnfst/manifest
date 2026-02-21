import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityScore1771800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'model_pricing' AND column_name = 'quality_score'`,
    );
    if (rows.length === 0) {
      await queryRunner.query(
        `ALTER TABLE model_pricing ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 3`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE model_pricing DROP COLUMN IF EXISTS quality_score`);
  }
}
