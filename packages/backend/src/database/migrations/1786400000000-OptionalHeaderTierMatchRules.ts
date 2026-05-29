import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptionalHeaderTierMatchRules1786400000000 implements MigrationInterface {
  name = 'OptionalHeaderTierMatchRules1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "header_tiers" ALTER COLUMN "header_key" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "header_tiers" ALTER COLUMN "header_value" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "header_tiers" SET "header_key" = '' WHERE "header_key" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "header_tiers" SET "header_value" = '' WHERE "header_value" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "header_tiers" ALTER COLUMN "header_key" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "header_tiers" ALTER COLUMN "header_value" SET NOT NULL`);
  }
}
