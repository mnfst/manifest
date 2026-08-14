import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBenchmarkHistory1788000000000 implements MigrationInterface {
  name = 'AddBenchmarkHistory1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "benchmark_runs" (
        "id" varchar PRIMARY KEY NOT NULL,
        "tenant_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "agent_name" varchar NOT NULL,
        "prompt" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_benchmark_runs_tenant"
          FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_benchmark_runs_agent"
          FOREIGN KEY ("agent_id")
          REFERENCES "agents"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_benchmark_runs_user_agent_created" ON "benchmark_runs" ("user_id", "agent_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "benchmark_columns" (
        "id" varchar PRIMARY KEY NOT NULL,
        "benchmark_run_id" varchar NOT NULL,
        "model" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "auth_type" varchar,
        "display_name" varchar,
        "status" varchar NOT NULL,
        "content" text,
        "headers" jsonb,
        "error_message" text,
        "input_tokens" integer,
        "output_tokens" integer,
        "cost_usd" decimal(10,6),
        "duration_ms" integer,
        "position" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_benchmark_columns_run"
          FOREIGN KEY ("benchmark_run_id")
          REFERENCES "benchmark_runs"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_benchmark_columns_run" ON "benchmark_columns" ("benchmark_run_id", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_benchmark_columns_run"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "benchmark_columns"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_benchmark_runs_user_agent_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "benchmark_runs"`);
  }
}
