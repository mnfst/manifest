import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderRegion1773650000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "region" varchar DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "region"`);
  }
}
