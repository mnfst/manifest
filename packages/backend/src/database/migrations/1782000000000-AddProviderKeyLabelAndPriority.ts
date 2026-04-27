import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderKeyLabelAndPriority1782000000000 implements MigrationInterface {
  name = 'AddProviderKeyLabelAndPriority1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "label" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "priority" integer`,
    );

    await queryRunner.query(
      `UPDATE "user_providers" SET "label" = 'Default' WHERE "label" IS NULL`,
    );
    await queryRunner.query(`UPDATE "user_providers" SET "priority" = 0 WHERE "priority" IS NULL`);

    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "label" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "priority" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "priority" SET DEFAULT 0`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "tier_assignments" ADD COLUMN IF NOT EXISTS "override_provider_key_label" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "specificity_assignments" ADD COLUMN IF NOT EXISTS "override_provider_key_label" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "specificity_assignments" DROP COLUMN IF EXISTS "override_provider_key_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tier_assignments" DROP COLUMN IF EXISTS "override_provider_key_label"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type")`,
    );
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "priority"`);
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "label"`);
  }
}
