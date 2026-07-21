import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores the workspace locale used by asynchronous, user-facing messages. */
export class AddTenantLocale1801300000000 implements MigrationInterface {
  name = 'AddTenantLocale1801300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "locale" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "locale"`);
  }
}
