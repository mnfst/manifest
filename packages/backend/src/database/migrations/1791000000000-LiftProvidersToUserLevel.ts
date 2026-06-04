import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiftProvidersToUserLevel1791000000000 implements MigrationInterface {
  name = 'LiftProvidersToUserLevel1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the agent/provider attachment table before changing uniqueness.
    await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "agent_provider_access" (
      "agent_id" varchar NOT NULL,
      "user_provider_id" varchar NOT NULL,
      CONSTRAINT "PK_agent_provider_access"
        PRIMARY KEY ("agent_id", "user_provider_id")
    )
  `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_provider_access_provider" ON "agent_provider_access" ("user_provider_id")`,
    );

    // 2. Backfill each old agent-scoped provider row as an explicit attachment.
    await queryRunner.query(`
    INSERT INTO "agent_provider_access" ("agent_id", "user_provider_id")
    SELECT "agent_id", "id"
    FROM "user_providers"
    WHERE "agent_id" IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

    // 3. Allow new global provider rows. Keep the legacy column/value around
    // for this PR; a later cleanup migration can drop it after the attachment
    // model has shipped safely.
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" DROP NOT NULL`);

    // 4. Disambiguate rows that collide on the new user-scoped uniqueness key
    //    (user_id, provider, auth_type, LOWER(label)) by RELABELING, never
    //    deleting. Keys are AES-256-GCM with a random IV so SQL can't prove two
    //    rows hold the same plaintext key; deleting "duplicates" would silently
    //    drop a distinct key. Suffix every colliding row past the first with
    //    its own (unique) id so no key is lost and the index in step 6 holds.
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

    // 5. Drop the old agent-scoped unique index (it references agent_id).
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);

    // 6. Create the new user-scoped unique index.
    await queryRunner.query(`
    CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"
    ON "user_providers" ("user_id", "provider", "auth_type", LOWER("label"))
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    UPDATE "user_providers" up
    SET "agent_id" = sub.agent_id
    FROM (
      SELECT DISTINCT ON ("user_provider_id") "user_provider_id", "agent_id"
      FROM "agent_provider_access"
      ORDER BY "user_provider_id", "agent_id"
    ) sub
    WHERE up."id" = sub."user_provider_id" AND up."agent_id" IS NULL
  `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"`);
    await queryRunner.query(`
    CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"
    ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
  `);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" SET NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_provider_access_provider"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_provider_access"`);
  }
}
