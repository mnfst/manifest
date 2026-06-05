import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalProviderScope1790500000000 implements MigrationInterface {
  name = 'AddGlobalProviderScope1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" DROP NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"
      ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
      WHERE "agent_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_providers_global_provider_auth_label"
      ON "user_providers" ("user_id", "provider", "auth_type", LOWER("label"))
      WHERE "agent_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user_providers" WHERE "agent_id" IS NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_global_provider_auth_label"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"
      ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
    `);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" SET NOT NULL`);
  }
}
