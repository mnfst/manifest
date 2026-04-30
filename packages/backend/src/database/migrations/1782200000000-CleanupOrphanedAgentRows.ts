import { MigrationInterface, QueryRunner } from 'typeorm';

const AGENT_ID_TABLES = [
  'agent_messages',
  'agent_logs',
  'tier_assignments',
  'specificity_assignments',
  'header_tiers',
  'user_providers',
  'llm_calls',
  'tool_executions',
  'notification_rules',
] as const;

// cost_snapshots / token_usage_snapshots exist in prod but have no TypeORM
// entity. Guard with to_regclass so this migration is safe in any schema state.
const OPTIONAL_AGENT_ID_TABLES = ['cost_snapshots', 'token_usage_snapshots'] as const;

export class CleanupOrphanedAgentRows1782200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of AGENT_ID_TABLES) {
      await queryRunner.query(
        `DELETE FROM "${table}"
         WHERE agent_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM "agents" a WHERE a.id = "${table}".agent_id)`,
      );
    }

    for (const table of OPTIONAL_AGENT_ID_TABLES) {
      const present = await queryRunner.query(`SELECT to_regclass($1) AS reg`, [table]);
      if (!present[0]?.reg) continue;
      await queryRunner.query(
        `DELETE FROM "${table}"
         WHERE agent_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM "agents" a WHERE a.id = "${table}".agent_id)`,
      );
    }

    await queryRunner.query(
      `DELETE FROM "notification_logs"
       WHERE rule_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "notification_rules" r WHERE r.id = "notification_logs".rule_id)`,
    );
  }

  public async down(): Promise<void> {
    // Cleanup-only migration; orphan rows cannot be restored.
  }
}
