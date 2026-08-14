import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullablePricing1772682112419 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE model_pricing ALTER COLUMN input_price_per_token DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE model_pricing ALTER COLUMN output_price_per_token DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill nulls to 0 before restoring NOT NULL
    await queryRunner.query(
      `UPDATE model_pricing SET input_price_per_token = 0 WHERE input_price_per_token IS NULL`,
    );
    await queryRunner.query(
      `UPDATE model_pricing SET output_price_per_token = 0 WHERE output_price_per_token IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE model_pricing ALTER COLUMN input_price_per_token SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE model_pricing ALTER COLUMN output_price_per_token SET NOT NULL`,
    );
  }
}
