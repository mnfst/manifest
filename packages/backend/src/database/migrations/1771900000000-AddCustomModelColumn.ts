import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomModelColumn1771900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'tier_assignments' AND column_name = 'custom_model'`,
    );
    if (rows.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "tier_assignments" ADD COLUMN "custom_model" varchar`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tier_assignments" DROP COLUMN IF EXISTS "custom_model"`,
    );
  }
}
