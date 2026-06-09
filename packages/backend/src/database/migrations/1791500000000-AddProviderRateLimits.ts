import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderRateLimits1791500000000 implements MigrationInterface {
  name = 'AddProviderRateLimits1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "provider_rate_limits" (
        "id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "auth_type" varchar NOT NULL,
        "key_label" varchar,
        "limit_type" varchar NOT NULL,
        "period" varchar NOT NULL,
        "limit_value" bigint,
        "used_value" bigint NOT NULL DEFAULT 0,
        "remaining_value" bigint,
        "resets_at" TIMESTAMP,
        "source" varchar NOT NULL DEFAULT 'header',
        "captured_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_provider_rate_limits" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_limits_user_provider" ON "provider_rate_limits" ("user_id", "provider", "captured_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limits_user_provider"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_rate_limits"`);
  }
}
