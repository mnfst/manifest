import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailProviderConfigs1771700000000 implements MigrationInterface {
  name = 'EmailProviderConfigs1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_provider_configs" (
        "id" character varying NOT NULL,
        "user_id" character varying NOT NULL,
        "provider" character varying NOT NULL,
        "api_key_encrypted" character varying NOT NULL,
        "domain" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_email_provider_configs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_email_provider_configs_user_id"
      ON "email_provider_configs" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_email_provider_configs_user_id"`);
    await queryRunner.query(`DROP TABLE "email_provider_configs"`);
  }
}
