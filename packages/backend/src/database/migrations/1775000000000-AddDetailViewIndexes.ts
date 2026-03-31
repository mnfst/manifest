import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetailViewIndexes1775000000000 implements MigrationInterface {
  name = 'AddDetailViewIndexes1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // llm_calls: queried by turn_id in message-details views
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_llm_calls_turn_id" ON "llm_calls" ("turn_id")`,
    );

    // tool_executions: queried by llm_call_id in message-details views
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tool_executions_llm_call_id" ON "tool_executions" ("llm_call_id")`,
    );

    // agent_logs: queried by trace_id in message-details views
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_logs_trace_id" ON "agent_logs" ("trace_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_logs_trace_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tool_executions_llm_call_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_llm_calls_turn_id"`);
  }
}
