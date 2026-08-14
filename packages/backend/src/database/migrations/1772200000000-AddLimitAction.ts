import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLimitAction1772200000000 implements MigrationInterface {
  name = 'AddLimitAction1772200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_rules' AND column_name = 'action'`,
    );
    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "notification_rules" ADD COLUMN "action" character varying NOT NULL DEFAULT 'notify'`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_rules" DROP COLUMN IF EXISTS "action"`,
    );
  }
}
