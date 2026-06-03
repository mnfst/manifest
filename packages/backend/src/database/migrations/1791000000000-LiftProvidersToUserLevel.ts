import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiftProvidersToUserLevel1791000000000 implements MigrationInterface {
  name = 'LiftProvidersToUserLevel1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Disambiguate rows that collide on the new user-scoped uniqueness key
    //    (user_id, provider, auth_type, LOWER(label)) by RELABELING, never
    //    deleting. Keys are AES-256-GCM with a random IV so SQL can't prove two
    //    rows hold the same plaintext key; deleting "duplicates" would silently
    //    drop a distinct key. Suffix every colliding row past the first with its
    //    own (unique) id so no key is lost and the index in step 4 holds.
    await queryRunner.query(`
    WITH ranked AS (
      SELECT "id", "label",
        ROW_NUMBER() OVER (
          PARTITION BY "user_id", "provider", "auth_type", LOWER("label")
          ORDER BY "priority" ASC, "connected_at" ASC, "id" ASC
        ) AS rn
      FROM "user_providers"
      WHERE "user_id" IS NOT NULL AND "label" IS NOT NULL
    )
    UPDATE "user_providers" up
    SET "label" = ranked."label" || ' [' || ranked."id" || ']'
    FROM ranked
    WHERE up."id" = ranked."id" AND ranked.rn > 1
  `);

    // 2. Drop the old agent-scoped unique index (it references agent_id).
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);

    // 3. Providers are now user-scoped — the agent_id column is dead. Drop it.
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "agent_id"`);

    // 4. Create the new user-scoped unique index.
    await queryRunner.query(`
    CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"
    ON "user_providers" ("user_id", "provider", "auth_type", LOWER("label"))
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN IF NOT EXISTS "agent_id" varchar`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"`);
    await queryRunner.query(`
    CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"
    ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
  `);
  }
}
