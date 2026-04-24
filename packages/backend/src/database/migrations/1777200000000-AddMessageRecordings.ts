import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageRecordings1777200000000 implements MigrationInterface {
  name = 'AddMessageRecordings1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "recorded" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_messages_recorded" ON "agent_messages" ("tenant_id", "timestamp") WHERE "recorded" = true`,
    );
    await queryRunner.query(`
      CREATE TABLE "message_recordings" (
        "message_id" varchar PRIMARY KEY REFERENCES "agent_messages"("id") ON DELETE CASCADE,
        "request_body" jsonb,
        "response_body" jsonb,
        "response_headers" jsonb,
        "size_bytes" integer,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_recordings"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_recorded"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "recorded"`);
  }
}
