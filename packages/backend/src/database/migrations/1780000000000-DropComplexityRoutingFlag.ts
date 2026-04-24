import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The idempotent `IF EXISTS` / `IF NOT EXISTS` guards protect two real
 * scenarios we've seen on production instances:
 *
 *   1. DB snapshot restored to a pre-1777100000000 state while the
 *      TypeORM `migrations` table keeps this entry recorded — without
 *      the guard, boot would succeed silently but `up()` would re-run
 *      on any subsequent migrationsRun and crash when the column is
 *      already missing.
 *   2. A fresh self-hosted install where `migrationsRun: true` plays
 *      the whole chain top-to-bottom but for unrelated reasons the
 *      1777100000000 add never actually committed (mid-transaction
 *      abort, etc.) — the drop would then 42703 on an absent column.
 *
 * The mirror `down()` guard keeps reversals safe if someone rolls back
 * on a DB where the column was never dropped in the first place.
 */
export class DropComplexityRoutingFlag1780000000000 implements MigrationInterface {
  name = 'DropComplexityRoutingFlag1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "complexity_routing_enabled"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the column as always-on so rollbacks match the always-on
    // product semantic (the original 1777100000000 migration added the
    // column with DEFAULT false and then UPDATEd existing rows to true;
    // repeating that dance on rollback would flip new agents back to off).
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "complexity_routing_enabled" boolean NOT NULL DEFAULT true`,
    );
  }
}
