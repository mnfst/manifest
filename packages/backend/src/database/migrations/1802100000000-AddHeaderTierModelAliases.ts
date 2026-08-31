import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHeaderTierModelAliases1802100000000 implements MigrationInterface {
  name = 'AddHeaderTierModelAliases1802100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "header_tiers" ADD COLUMN "model_alias" varchar(48) DEFAULT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "header_tiers"
      ADD CONSTRAINT "CHK_header_tiers_model_alias"
      CHECK (
        "model_alias" IS NULL OR (
          "model_alias" <> 'auto'
          AND "model_alias" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_header_tiers_agent_model_alias"
      ON "header_tiers" ("agent_id", "model_alias")
      WHERE "model_alias" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_header_tiers_agent_model_alias"`);
    await queryRunner.query(
      `ALTER TABLE "header_tiers" DROP CONSTRAINT IF EXISTS "CHK_header_tiers_model_alias"`,
    );
    await queryRunner.query(`ALTER TABLE "header_tiers" DROP COLUMN "model_alias"`);
  }
}
