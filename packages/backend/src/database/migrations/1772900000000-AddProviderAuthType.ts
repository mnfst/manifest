import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderAuthType1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD "auth_type" varchar NOT NULL DEFAULT 'api_key'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN "auth_type"`);
  }
}
