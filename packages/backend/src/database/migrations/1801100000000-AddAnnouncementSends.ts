import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ledger for one-shot broadcast emails (release announcements). One row per
 * (announcement, email): the announcement services check it before sending,
 * so restarts and redeploys never double-send.
 */
export class AddAnnouncementSends1801100000000 implements MigrationInterface {
  name = 'AddAnnouncementSends1801100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_sends" (
        "announcement" varchar NOT NULL,
        "email" varchar NOT NULL,
        "sent_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcement_sends" PRIMARY KEY ("announcement", "email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_sends"`);
  }
}
