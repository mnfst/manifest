import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-tag Ollama and LM Studio `user_providers` rows from `auth_type='api_key'`
 * to `auth_type='local'`. No DDL — `auth_type` is already a varchar. The
 * matching frontend badge/modal changes land in the same release; if the
 * backend gets rolled back while the DB still carries `'local'` rows, run
 * `down()` before downgrading.
 */
export class BackfillLocalAuthType1777200000000 implements MigrationInterface {
  name = 'BackfillLocalAuthType1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dedupe first: the unique index on (agent_id, provider, auth_type) would
    // reject the UPDATE if a `'local'` row already exists for the same
    // (agent_id, provider). Drop the legacy `'api_key'` row in that case — the
    // `'local'` row is authoritative under the new scheme.
    await queryRunner.query(`
      DELETE FROM "user_providers" u
      WHERE u."provider" IN ('ollama', 'lmstudio')
        AND u."auth_type" = 'api_key'
        AND EXISTS (
          SELECT 1 FROM "user_providers" v
          WHERE v."agent_id" = u."agent_id"
            AND v."provider" = u."provider"
            AND v."auth_type" = 'local'
        )
    `);

    await queryRunner.query(`
      UPDATE "user_providers"
      SET "auth_type" = 'local'
      WHERE "provider" IN ('ollama', 'lmstudio')
        AND "auth_type" = 'api_key'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Mirror-image of up(): if an `api_key` row was created after the
    // backfill ran (e.g. the user reconnected Ollama on an older binary
    // that doesn't know about 'local'), the reverse UPDATE would collide
    // with the unique (agent_id, provider, auth_type) index. Drop the
    // stale 'local' row in that case — the 'api_key' row is authoritative
    // under the pre-backfill scheme.
    await queryRunner.query(`
      DELETE FROM "user_providers" u
      WHERE u."provider" IN ('ollama', 'lmstudio')
        AND u."auth_type" = 'local'
        AND EXISTS (
          SELECT 1 FROM "user_providers" v
          WHERE v."agent_id" = u."agent_id"
            AND v."provider" = u."provider"
            AND v."auth_type" = 'api_key'
        )
    `);

    await queryRunner.query(`
      UPDATE "user_providers"
      SET "auth_type" = 'api_key'
      WHERE "provider" IN ('ollama', 'lmstudio')
        AND "auth_type" = 'local'
    `);
  }
}
