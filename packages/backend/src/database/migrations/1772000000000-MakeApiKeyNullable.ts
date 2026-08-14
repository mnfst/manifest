import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeApiKeyNullable1772000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ALTER COLUMN "api_key_encrypted" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ALTER COLUMN "api_key_encrypted" SET DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "user_providers" SET "api_key_encrypted" = '' WHERE "api_key_encrypted" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ALTER COLUMN "api_key_encrypted" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ALTER COLUMN "api_key_encrypted" DROP DEFAULT`,
    );
  }
}
