import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * This migration was renamed from `AddAgentRecordMessages1777100000000` during
 * the main-branch merge to avoid a timestamp collision with three other
 * migrations at `1777100000000`. TypeORM tracks applied migrations by name,
 * so on any DB where the previous class name was already recorded the
 * renamed migration looks new and runs a second time — `IF NOT EXISTS`
 * keeps the re-run safe.
 */
export class AddAgentRecordMessages1777110000000 implements MigrationInterface {
  name = 'AddAgentRecordMessages1777110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "record_messages" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN IF EXISTS "record_messages"`);
  }
}
