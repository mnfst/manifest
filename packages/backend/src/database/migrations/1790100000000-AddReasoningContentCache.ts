import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReasoningContentCache1790100000000 implements MigrationInterface {
  name = 'AddReasoningContentCache1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reasoning_content_cache" (
        "session_key" varchar NOT NULL,
        "first_tool_call_id" varchar NOT NULL,
        "content" text NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_reasoning_content_cache"
          PRIMARY KEY ("session_key", "first_tool_call_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reasoning_content_cache_expires" ON "reasoning_content_cache" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reasoning_content_cache_expires"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reasoning_content_cache"`);
  }
}
