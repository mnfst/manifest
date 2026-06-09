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
    // The "latest snapshot" lookup keys on the full connection identity
    // (user, provider, auth_type, key_label, limit_type) ordered by capture
    // time, so the index must carry that whole tuple — keying on
    // (user, provider) alone collapsed distinct auth types / labels.
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_limits_connection_latest" ON "provider_rate_limits" ("user_id", "provider", "auth_type", "key_label", "limit_type", "captured_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limits_connection_latest"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_rate_limits"`);
  }
}
