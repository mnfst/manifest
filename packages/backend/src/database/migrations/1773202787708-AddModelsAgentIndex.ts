import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModelsAgentIndex1773202787708 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_agent_model"
        ON "agent_messages" ("tenant_id", "agent_name", "model")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_tenant_agent_model"`);
  }
}
