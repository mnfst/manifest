import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExposedModelRoutes1795200000000 implements MigrationInterface {
  name = 'AddExposedModelRoutes1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exposed_model_routes" (
        "id" varchar NOT NULL,
        "tenant_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "model_id" varchar NOT NULL,
        "display_name" varchar,
        "enabled" boolean NOT NULL DEFAULT true,
        "source_kind" varchar NOT NULL,
        "source_key" varchar,
        "route" jsonb,
        "fallback_routes" jsonb,
        "request_params" jsonb,
        "response_mode" varchar NOT NULL DEFAULT 'buffered',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_exposed_model_routes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_exposed_model_routes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_exposed_model_routes_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_exposed_model_routes_source_kind" CHECK ("source_kind" IN ('direct', 'tier', 'specificity', 'header_tier'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_exposed_model_routes_agent_model_lower" ON "exposed_model_routes" ("agent_id", lower("model_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_exposed_model_routes_agent_enabled" ON "exposed_model_routes" ("agent_id", "enabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_exposed_model_routes_agent_enabled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_exposed_model_routes_agent_model_lower"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exposed_model_routes"`);
  }
}
