import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomProviders1772668898071 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "custom_providers" (
        "id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "base_url" varchar NOT NULL,
        "models" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_custom_providers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_custom_providers_agent" FOREIGN KEY ("agent_id")
          REFERENCES "agents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_custom_providers_agent_name"
        ON "custom_providers" ("agent_id", "name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_providers_agent_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_providers"`);
  }
}
