import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the single-column index IDX_agent_api_keys_key_prefix on
 * agent_api_keys.(key_prefix). It is fully subsumed by the composite
 * IDX_agent_api_keys_prefix_active on (key_prefix, is_active) created in
 * 1790000000000 — Postgres can use the composite for any query that only
 * filters key_prefix, so the standalone index is dead weight on writes.
 *
 * NOTE: this only removes the agent_api_keys index. The separate
 * IDX_api_keys_key_prefix on the api_keys table has no composite covering it
 * and is intentionally left in place.
 */
export class DropRedundantAgentApiKeyPrefixIndex1790400000000 implements MigrationInterface {
  name = 'DropRedundantAgentApiKeyPrefixIndex1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_api_keys_key_prefix"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_api_keys_key_prefix" ON "agent_api_keys" ("key_prefix")`,
    );
  }
}
