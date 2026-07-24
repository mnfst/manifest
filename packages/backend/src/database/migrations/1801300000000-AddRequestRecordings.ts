import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestRecordings1801300000000 implements MigrationInterface {
  name = 'AddRequestRecordings1801300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "record_messages" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "request_recordings" (
        "request_id" varchar NOT NULL,
        "request_body" jsonb NOT NULL,
        "response_body" jsonb,
        "api_format" varchar NOT NULL,
        "size_bytes" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_request_recordings" PRIMARY KEY ("request_id"),
        CONSTRAINT "FK_request_recordings_request"
          FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_request_recordings_created_at" ON "request_recordings" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "request_recordings"`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN IF EXISTS "record_messages"`);
  }
}
