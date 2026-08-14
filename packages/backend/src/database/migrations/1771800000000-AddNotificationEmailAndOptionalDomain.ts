import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationEmailAndOptionalDomain1771800000000 implements MigrationInterface {
  name = 'AddNotificationEmailAndOptionalDomain1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_provider_configs" ADD COLUMN "notification_email" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_provider_configs" ALTER COLUMN "domain" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_provider_configs" ALTER COLUMN "domain" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_provider_configs" DROP COLUMN "notification_email"`,
    );
  }
}
