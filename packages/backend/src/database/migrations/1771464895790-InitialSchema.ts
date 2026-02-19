import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1771464895790 implements MigrationInterface {
    name = 'InitialSchema1771464895790'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Skip if schema already exists (DB created by synchronize: true)
        const tables = await queryRunner.query(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants'`,
        );
        if (tables.length > 0) return;

        await queryRunner.query(`CREATE TABLE "tool_executions" ("id" character varying NOT NULL, "tenant_id" character varying, "agent_id" character varying, "llm_call_id" character varying, "tool_name" character varying NOT NULL, "duration_ms" integer, "status" character varying NOT NULL DEFAULT 'ok', "error_message" character varying, CONSTRAINT "PK_bdd7e5fafce34f8647fde510aff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7fc8d9c06936a673fd5c404706" ON "tool_executions" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a24432cde19440451cc7b5d15f" ON "tool_executions" ("agent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d007c4a559001d501d06fb6f4" ON "tool_executions" ("tenant_id", "agent_id") `);
        await queryRunner.query(`CREATE TABLE "security_event" ("id" character varying NOT NULL, "session_key" character varying, "timestamp" TIMESTAMP NOT NULL, "severity" character varying NOT NULL, "category" character varying NOT NULL, "description" character varying NOT NULL, "user_id" character varying, CONSTRAINT "PK_fb070407ce281c218223836bad4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notification_rules" ("id" character varying NOT NULL, "tenant_id" character varying NOT NULL, "agent_id" character varying NOT NULL, "agent_name" character varying NOT NULL, "user_id" character varying NOT NULL, "metric_type" character varying NOT NULL, "threshold" numeric(15,6) NOT NULL, "period" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "PK_eb87ba4f7f01eabf003fcf4e65c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_47769ef426d10cb4f079a0451b" ON "notification_rules" ("tenant_id", "agent_id") `);
        await queryRunner.query(`CREATE TABLE "agent_api_keys" ("id" character varying NOT NULL, "key" character varying(64) NOT NULL, "label" character varying, "tenant_id" character varying NOT NULL, "agent_id" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "expires_at" TIMESTAMP, "last_used_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "REL_8c341005a4d7642cd4b0f53e13" UNIQUE ("agent_id"), CONSTRAINT "PK_f6aea58a209eb8dc0734b9cc0da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9357d38f073722e36f2f281276" ON "agent_api_keys" ("key") `);
        await queryRunner.query(`CREATE TABLE "agents" ("id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "tenant_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ab2b5ee2849c9ecfb1eb57d1f3" ON "agents" ("tenant_id", "name") `);
        await queryRunner.query(`CREATE TABLE "tenants" ("id" character varying NOT NULL, "name" character varying NOT NULL, "organization_name" character varying, "email" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "UQ_32731f181236a46182a38c992a8" UNIQUE ("name"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "token_usage_snapshots" ("id" character varying NOT NULL, "tenant_id" character varying, "agent_id" character varying, "agent_name" character varying, "snapshot_time" TIMESTAMP NOT NULL, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "cache_read_tokens" integer NOT NULL DEFAULT '0', "cache_creation_tokens" integer NOT NULL DEFAULT '0', "total_tokens" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_70e30ce7ced706c96a4d975a896" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_305fe9e3e5efff31a20a90c12e" ON "token_usage_snapshots" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_49c9b53af0ef0839174ce670ef" ON "token_usage_snapshots" ("agent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3af795abffe699032a63ff5c22" ON "token_usage_snapshots" ("tenant_id", "agent_id", "snapshot_time") `);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" character varying NOT NULL, "rule_id" character varying NOT NULL, "period_start" TIMESTAMP NOT NULL, "period_end" TIMESTAMP NOT NULL, "actual_value" numeric(15,6) NOT NULL, "threshold_value" numeric(15,6) NOT NULL, "metric_type" character varying NOT NULL, "agent_name" character varying NOT NULL, "sent_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_951323f7afddb097bfbda22542" ON "notification_logs" ("rule_id", "period_start") `);
        await queryRunner.query(`CREATE TABLE "model_pricing" ("model_name" character varying NOT NULL, "input_price_per_token" numeric(12,10) NOT NULL, "output_price_per_token" numeric(12,10) NOT NULL, "provider" character varying NOT NULL DEFAULT '', "updated_at" character varying, CONSTRAINT "PK_40967c2092c230caebcc821b52a" PRIMARY KEY ("model_name"))`);
        await queryRunner.query(`CREATE TABLE "cost_snapshots" ("id" character varying NOT NULL, "tenant_id" character varying, "agent_id" character varying, "agent_name" character varying, "snapshot_time" TIMESTAMP NOT NULL, "cost_usd" numeric(10,6) NOT NULL DEFAULT '0', "model" character varying, CONSTRAINT "PK_d2958ea9b14c1e2d5c0f7a61b92" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_468b7d3a69ee28a127cd8287b9" ON "cost_snapshots" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3bf823e7c31aa4a5f12fcde527" ON "cost_snapshots" ("agent_id") `);
        await queryRunner.query(`CREATE TABLE "llm_calls" ("id" character varying NOT NULL, "tenant_id" character varying, "agent_id" character varying, "turn_id" character varying, "call_index" integer, "gen_ai_system" character varying, "request_model" character varying, "response_model" character varying, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "cache_read_tokens" integer NOT NULL DEFAULT '0', "cache_creation_tokens" integer NOT NULL DEFAULT '0', "duration_ms" integer, "ttft_ms" integer, "temperature" numeric(3,2), "max_output_tokens" integer, "timestamp" TIMESTAMP NOT NULL, CONSTRAINT "PK_927dd9d5a428274e38a05706af8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ff92361a95863b8f0de3a371e5" ON "llm_calls" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3e44ae5bdb48ceeb10d7880cf" ON "llm_calls" ("agent_id") `);
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" character varying NOT NULL, "key" character varying NOT NULL, "user_id" character varying NOT NULL, "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT NOW(), "last_used_at" TIMESTAMP, CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "agent_messages" ("id" character varying NOT NULL, "tenant_id" character varying, "agent_id" character varying, "trace_id" character varying, "session_key" character varying, "session_id" character varying, "timestamp" TIMESTAMP NOT NULL, "duration_ms" integer, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "cache_read_tokens" integer NOT NULL DEFAULT '0', "cache_creation_tokens" integer NOT NULL DEFAULT '0', "cost_usd" numeric(10,6), "status" character varying NOT NULL DEFAULT 'ok', "error_message" character varying, "description" character varying, "service_type" character varying, "agent_name" character varying, "model" character varying, "skill_name" character varying, "user_id" character varying, CONSTRAINT "PK_8c7cdeda30e81dba421925df4fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_519ec0b8e9fc7c2e53d300c69c" ON "agent_messages" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d3c0f0f21ffa94c7300a2e996" ON "agent_messages" ("agent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc0146344144249cd7dde2f8ad" ON "agent_messages" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b920481d4d296ccce0647d6a8a" ON "agent_messages" ("tenant_id", "agent_id", "timestamp") `);
        await queryRunner.query(`CREATE TABLE "agent_logs" ("id" character varying NOT NULL, "tenant_id" character varying, "agent_id" character varying, "timestamp" TIMESTAMP NOT NULL, "agent_name" character varying, "severity" character varying NOT NULL DEFAULT 'info', "body" text, "trace_id" character varying, "span_id" character varying, "attributes" text, CONSTRAINT "PK_2cc52efab0f963454d7006a6981" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e981397068db115bcd95a39396" ON "agent_logs" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_039a398c03e68e46a0fc0bc998" ON "agent_logs" ("agent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9678de7cf6f122f3286bb4075" ON "agent_logs" ("tenant_id", "agent_id", "timestamp") `);
        await queryRunner.query(`ALTER TABLE "agent_api_keys" ADD CONSTRAINT "FK_25add637eabf3b78d8a46bc4976" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_api_keys" ADD CONSTRAINT "FK_8c341005a4d7642cd4b0f53e134" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agents" ADD CONSTRAINT "FK_87e9fdd9a00cd5fa5768aa0e6be" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agents" DROP CONSTRAINT "FK_87e9fdd9a00cd5fa5768aa0e6be"`);
        await queryRunner.query(`ALTER TABLE "agent_api_keys" DROP CONSTRAINT "FK_8c341005a4d7642cd4b0f53e134"`);
        await queryRunner.query(`ALTER TABLE "agent_api_keys" DROP CONSTRAINT "FK_25add637eabf3b78d8a46bc4976"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e9678de7cf6f122f3286bb4075"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_039a398c03e68e46a0fc0bc998"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e981397068db115bcd95a39396"`);
        await queryRunner.query(`DROP TABLE "agent_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b920481d4d296ccce0647d6a8a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc0146344144249cd7dde2f8ad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1d3c0f0f21ffa94c7300a2e996"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_519ec0b8e9fc7c2e53d300c69c"`);
        await queryRunner.query(`DROP TABLE "agent_messages"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3e44ae5bdb48ceeb10d7880cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff92361a95863b8f0de3a371e5"`);
        await queryRunner.query(`DROP TABLE "llm_calls"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bf823e7c31aa4a5f12fcde527"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_468b7d3a69ee28a127cd8287b9"`);
        await queryRunner.query(`DROP TABLE "cost_snapshots"`);
        await queryRunner.query(`DROP TABLE "model_pricing"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_951323f7afddb097bfbda22542"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3af795abffe699032a63ff5c22"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49c9b53af0ef0839174ce670ef"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_305fe9e3e5efff31a20a90c12e"`);
        await queryRunner.query(`DROP TABLE "token_usage_snapshots"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab2b5ee2849c9ecfb1eb57d1f3"`);
        await queryRunner.query(`DROP TABLE "agents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9357d38f073722e36f2f281276"`);
        await queryRunner.query(`DROP TABLE "agent_api_keys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47769ef426d10cb4f079a0451b"`);
        await queryRunner.query(`DROP TABLE "notification_rules"`);
        await queryRunner.query(`DROP TABLE "security_event"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d007c4a559001d501d06fb6f4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a24432cde19440451cc7b5d15f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7fc8d9c06936a673fd5c404706"`);
        await queryRunner.query(`DROP TABLE "tool_executions"`);
    }

}
