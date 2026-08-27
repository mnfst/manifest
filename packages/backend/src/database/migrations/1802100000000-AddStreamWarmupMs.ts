import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-tier and per-provider stream warmup overrides (ms).
 *
 * Both columns are nullable: null means "inherit" — the proxy falls back to
 * the next level of the chain (tier -> provider -> STREAM_WARMUP_MS env ->
 * 15000 ms built-in default), so existing rows need no backfill and behavior
 * is unchanged until someone sets a value.
 */
export class AddStreamWarmupMs1802100000000 implements MigrationInterface {
  name = 'AddStreamWarmupMs1802100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Catalog-only adds, but they take ACCESS EXCLUSIVE — bound the wait so a
    // deploy queues behind a long read instead of blocking the table.
    await queryRunner.query(`SET LOCAL lock_timeout = 5s`);
    await queryRunner.query(
      `ALTER TABLE "header_tiers" ADD COLUMN IF NOT EXISTS "stream_warmup_ms" integer DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_providers" ADD COLUMN IF NOT EXISTS "stream_warmup_ms" integer DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = 5s`);
    await queryRunner.query(`ALTER TABLE "header_tiers" DROP COLUMN IF EXISTS "stream_warmup_ms"`);
    await queryRunner.query(
      `ALTER TABLE "tenant_providers" DROP COLUMN IF EXISTS "stream_warmup_ms"`,
    );
  }
}
