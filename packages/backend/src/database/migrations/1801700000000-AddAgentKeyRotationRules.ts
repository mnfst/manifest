import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-agent (harness) key rotation rules.
 *
 * One row per (agent, model): an ordered list of provider API-key labels.
 * When the proxy attempts that model (as primary or as any fallback-chain
 * slot) and a rule exists, the rule fully controls which key is used — the
 * first unused label is tried, each fallback-triggering failure rotates to
 * the next label for the SAME model (the failed attempt is marked
 * superseded and consumes no fallback-chain slot), and when the order is
 * exhausted the model counts as failed and the chain advances to the next
 * model.
 *
 * The unique index is on (agent_id, model): a rule is keyed by the runtime
 * model identity, so a tenant cannot configure two different key orders for
 * the same model on the same harness.
 */
export class AddAgentKeyRotationRules1801700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_key_rotation_rules" (
        "id" varchar PRIMARY KEY,
        "tenant_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "model" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "key_order" jsonb NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    // Unique per (agent, model) — the identity the rotation lookup keys on.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_key_rotation_rules_agent_model"
      ON "agent_key_rotation_rules" ("agent_id", "model")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_key_rotation_rules_agent"
      ON "agent_key_rotation_rules" ("agent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_key_rotation_rules_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_key_rotation_rules_agent_model"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_key_rotation_rules"`);
  }
}
