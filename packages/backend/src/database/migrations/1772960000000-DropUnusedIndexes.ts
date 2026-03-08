import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUnusedIndexes1772960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // tool_executions: write-only table, zero read queries
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_4d007c4a559001d501d06fb6f4"`);

    // token_usage_snapshots: write-only table, zero read queries
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_3af795abffe699032a63ff5c22"`);

    // cost_snapshots: write-only table, zero read queries
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cost_snapshots_tenant_agent_time"`);

    // agent_logs: write-only table, zero read queries
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_e9678de7cf6f122f3286bb4075"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_4d007c4a559001d501d06fb6f4" ON "tool_executions" ("tenant_id", "agent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3af795abffe699032a63ff5c22" ON "token_usage_snapshots" ("tenant_id", "agent_id", "snapshot_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cost_snapshots_tenant_agent_time" ON "cost_snapshots" ("tenant_id", "agent_id", "snapshot_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9678de7cf6f122f3286bb4075" ON "agent_logs" ("tenant_id", "agent_id", "timestamp")`,
    );
  }
}
