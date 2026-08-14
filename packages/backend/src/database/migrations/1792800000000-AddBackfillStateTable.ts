import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marker table for one-time post-deploy backfills. A row is written when a
 * named backfill finishes so the boot task that runs it does so exactly once
 * per install. Metadata-only CREATE — instant, no impact on the lock window.
 */
export class AddBackfillStateTable1792800000000 implements MigrationInterface {
  name = 'AddBackfillStateTable1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "backfill_state" (
        "name" varchar NOT NULL,
        "completed_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_backfill_state" PRIMARY KEY ("name")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "backfill_state"`);
  }
}
