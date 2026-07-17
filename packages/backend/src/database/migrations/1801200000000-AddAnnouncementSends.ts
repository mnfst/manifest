import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ledger for one-shot broadcast emails (release announcements). One row per
 * (announcement, email). Inserting the row is the atomic delivery claim;
 * sent_at is filled only after the provider accepts the email.
 */
export class AddAnnouncementSends1801200000000 implements MigrationInterface {
  name = 'AddAnnouncementSends1801200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_sends" (
        "announcement" varchar NOT NULL,
        "email" varchar NOT NULL,
        "claimed_at" TIMESTAMP NOT NULL DEFAULT now(),
        "sent_at" TIMESTAMP,
        CONSTRAINT "PK_announcement_sends" PRIMARY KEY ("announcement", "email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_sends"`);
  }
}
