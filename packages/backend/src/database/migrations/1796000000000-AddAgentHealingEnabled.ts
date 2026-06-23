import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-agent request-healing activation. Presence of a row = healing enabled for
 * that agent (same model as `agent_enabled_providers`). CASCADE on agent delete.
 */
export class AddAgentHealingEnabled1796000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_healing_enabled" (
        "agent_id" varchar NOT NULL,
        CONSTRAINT "PK_agent_healing_enabled" PRIMARY KEY ("agent_id"),
        CONSTRAINT "FK_agent_healing_enabled_agent" FOREIGN KEY ("agent_id")
          REFERENCES "agents" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_healing_enabled"`);
  }
}
