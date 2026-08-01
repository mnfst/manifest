import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds provider-scope key rotation rules.
 *
 * Previously every rule was keyed by (agent, model). A harness may now define
 * a PROVIDER-wide rule (ordered key labels applying to every model of that
 * provider), with the model-scope rule taking precedence for its model. This
 * migration:
 *  - adds `scope` (`'model'` default, values `'model' | 'provider'`),
 *  - relaxes `model` to nullable (provider rules carry NULL),
 *  - adds a partial unique index on (agent_id, provider) WHERE scope =
 *    'provider' so a harness cannot configure two provider rules for the
 *    same provider.
 *
 * The existing (agent_id, model) unique index is kept as-is: Postgres treats
 * NULLs as distinct, so provider rules (model = NULL) never collide with it
 * or with each other under it — the partial index is the provider-scope
 * uniqueness guarantee.
 */
export class AddKeyRuleScope1801800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_key_rotation_rules"
      ADD COLUMN IF NOT EXISTS "scope" varchar NOT NULL DEFAULT 'model'
    `);

    await queryRunner.query(`
      ALTER TABLE "agent_key_rotation_rules"
      ALTER COLUMN "model" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_key_rotation_rules_agent_provider"
      ON "agent_key_rotation_rules" ("agent_id", "provider")
      WHERE "scope" = 'provider'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_agent_key_rotation_rules_agent_provider"
    `);

    // Restore NOT NULL for model-scope rows (provider rows are dropped —
    // rollback of the feature removes its data).
    await queryRunner.query(`
      DELETE FROM "agent_key_rotation_rules" WHERE "model" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "agent_key_rotation_rules"
      ALTER COLUMN "model" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "agent_key_rotation_rules"
      DROP COLUMN IF EXISTS "scope"
    `);
  }
}
