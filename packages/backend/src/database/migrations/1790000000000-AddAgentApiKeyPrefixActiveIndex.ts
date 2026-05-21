import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentApiKeyPrefixActiveIndex1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The agent-key auth guard runs on every OTLP / proxy request and filters
    // by (key_prefix, is_active). A composite index lets the planner seek
    // straight to active keys instead of scanning every key sharing a prefix.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_api_keys_prefix_active" ON "agent_api_keys" ("key_prefix", "is_active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_api_keys_prefix_active"`);
  }
}
