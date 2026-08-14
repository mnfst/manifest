import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up to BackfillLocalAuthType: LM Studio (and any custom provider
 * pointing at a canonical local runner) is stored in `user_providers` as
 * `custom:<uuid>` with `auth_type='api_key'` because the tile creates a
 * row in `custom_providers` rather than using the shared provider ID.
 * The earlier migration's `provider IN ('ollama', 'lmstudio')` clause
 * therefore missed them, leaving routed messages tagged as `'api_key'`
 * instead of `'local'`.
 *
 * This migration re-tags those rows by joining against `custom_providers`
 * and matching the display name (normalized to collapse `LM Studio` /
 * `lm-studio` / `lmstudio`) against the canonical local IDs. Dedupe-before-
 * update as in the first migration.
 */
export class BackfillLocalCustomProviders1777300000000 implements MigrationInterface {
  name = 'BackfillLocalCustomProviders1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dedupe: if the same (agent_id, provider) already has a 'local' row,
    // drop the stray api_key row so the UPDATE doesn't collide with the
    // unique (agent_id, provider, auth_type) index.
    await queryRunner.query(`
      DELETE FROM "user_providers" u
      WHERE u."provider" LIKE 'custom:%'
        AND u."auth_type" = 'api_key'
        AND EXISTS (
          SELECT 1 FROM "user_providers" v
          WHERE v."agent_id" = u."agent_id"
            AND v."provider" = u."provider"
            AND v."auth_type" = 'local'
        )
    `);

    // Re-tag: match the paired custom_providers.name after normalizing
    // (lowercase, strip spaces/dots/underscores/hyphens). The allow-list
    // stays in sync with CANONICAL_LOCAL_IDS in packages/shared — if a
    // new local runner is added there, bump this list in a follow-up
    // migration.
    await queryRunner.query(`
      UPDATE "user_providers" u
      SET "auth_type" = 'local'
      WHERE u."provider" LIKE 'custom:%'
        AND u."auth_type" = 'api_key'
        AND EXISTS (
          SELECT 1 FROM "custom_providers" cp
          WHERE ('custom:' || cp.id) = u."provider"
            AND LOWER(REGEXP_REPLACE(cp.name, '[[:space:]._-]+', '', 'g'))
                IN ('ollama', 'lmstudio', 'lmstudio')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dedupe before reversing: if an api_key row for the same
    // (agent_id, custom:<uuid>) materialized after the up() ran, the
    // reverse UPDATE would collide with the unique index.
    await queryRunner.query(`
      DELETE FROM "user_providers" u
      WHERE u."provider" LIKE 'custom:%'
        AND u."auth_type" = 'local'
        AND EXISTS (
          SELECT 1 FROM "user_providers" v
          WHERE v."agent_id" = u."agent_id"
            AND v."provider" = u."provider"
            AND v."auth_type" = 'api_key'
        )
        AND EXISTS (
          SELECT 1 FROM "custom_providers" cp
          WHERE ('custom:' || cp.id) = u."provider"
            AND LOWER(REGEXP_REPLACE(cp.name, '[[:space:]._-]+', '', 'g'))
                IN ('ollama', 'lmstudio')
        )
    `);

    await queryRunner.query(`
      UPDATE "user_providers" u
      SET "auth_type" = 'api_key'
      WHERE u."provider" LIKE 'custom:%'
        AND u."auth_type" = 'local'
        AND EXISTS (
          SELECT 1 FROM "custom_providers" cp
          WHERE ('custom:' || cp.id) = u."provider"
            AND LOWER(REGEXP_REPLACE(cp.name, '[[:space:]._-]+', '', 'g'))
                IN ('ollama', 'lmstudio')
        )
    `);
  }
}
