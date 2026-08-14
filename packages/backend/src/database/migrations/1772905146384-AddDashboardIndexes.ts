import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDashboardIndexes1772905146384 implements MigrationInterface {
  name = 'AddDashboardIndexes1772905146384';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dashboard aggregate queries (overview, tokens, costs, timeseries)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_timestamp" ON "agent_messages" ("tenant_id", "timestamp")`,
    );

    // OTLP trace dedup check on ingestion
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_trace" ON "agent_messages" ("tenant_id", "trace_id")`,
    );

    // notification_rules: listRules() by user_id + agent_name
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_rules_user_agent" ON "notification_rules" ("user_id", "agent_name")`,
    );

    // notification_rules: getActiveBlockRules() by tenant_id + agent_name
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_rules_tenant_agent" ON "notification_rules" ("tenant_id", "agent_name")`,
    );

    // getDistinctModels() — faster DISTINCT scan
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_model" ON "agent_messages" ("tenant_id", "model")`,
    );

    // OTLP trace dedup: recent error lookup per agent on every ingested span
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_agent_status" ON "agent_messages" ("tenant_id", "agent_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_tenant_agent_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_tenant_model"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_rules_tenant_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_rules_user_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_tenant_trace"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_tenant_timestamp"`);
  }
}
