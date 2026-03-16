import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailProviderKeyPrefix1773300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_provider_configs" ADD COLUMN "key_prefix" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "email_provider_configs" DROP COLUMN "key_prefix"`);
  }
}
