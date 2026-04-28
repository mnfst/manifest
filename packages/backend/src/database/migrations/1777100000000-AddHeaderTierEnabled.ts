import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHeaderTierEnabled1777100000000 implements MigrationInterface {
  name = 'AddHeaderTierEnabled1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "header_tiers" ADD COLUMN "enabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "header_tiers" DROP COLUMN "enabled"`);
  }
}
