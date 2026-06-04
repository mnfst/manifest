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
    //    drop a distinct key. For old agent-scoped "Default" connections, use
    //    the agent display name so the global connection keeps its source
    //    context. Custom labels keep the user's label and append the source
    //    agent name. If the generated label is still not unique, suffix with
    //    the row id.
    await queryRunner.query(`
    WITH colliding_labels AS (
      SELECT "user_id", "provider", "auth_type", LOWER("label") AS "label_key"
      FROM "user_providers"
      WHERE "user_id" IS NOT NULL AND "label" IS NOT NULL
      GROUP BY "user_id", "provider", "auth_type", LOWER("label")
      HAVING COUNT(*) > 1
    ),
    agent_labels AS (
      SELECT
        up."id",
        up."user_id",
        up."provider",
        up."auth_type",
        up."label",
        up."priority",
        up."connected_at",
        COALESCE(
          NULLIF(TRIM(a."display_name"), ''),
          NULLIF(TRIM(a."name"), ''),
          up."agent_id",
          up."id"
        ) AS "agent_label"
      FROM "user_providers" up
      JOIN colliding_labels c
        ON c."user_id" = up."user_id"
        AND c."provider" = up."provider"
        AND c."auth_type" IS NOT DISTINCT FROM up."auth_type"
        AND c."label_key" = LOWER(up."label")
      LEFT JOIN "agents" a ON a."id" = up."agent_id"
    ),
    proposed AS (
      SELECT
        "id",
        "user_id",
        "provider",
        "auth_type",
        "priority",
        "connected_at",
        CASE
          WHEN LOWER("label") = 'default' THEN "agent_label"
          ELSE "label" || ' - ' || "agent_label"
        END AS "proposed_label"
      FROM agent_labels
    ),
    ranked AS (
      SELECT
        p.*,
        ROW_NUMBER() OVER (
          PARTITION BY p."user_id", p."provider", p."auth_type", LOWER(p."proposed_label")
          ORDER BY p."priority" ASC, p."connected_at" ASC, p."id" ASC
        ) AS "generated_rn",
        EXISTS (
          SELECT 1
          FROM "user_providers" existing
          WHERE existing."user_id" = p."user_id"
            AND existing."provider" = p."provider"
            AND existing."auth_type" IS NOT DISTINCT FROM p."auth_type"
            AND LOWER(existing."label") = LOWER(p."proposed_label")
            AND NOT EXISTS (
              SELECT 1 FROM proposed p2 WHERE p2."id" = existing."id"
            )
        ) AS "collides_with_existing"
      FROM proposed p
    )
    UPDATE "user_providers" up
    SET "label" = CASE
      WHEN ranked."generated_rn" = 1 AND NOT ranked."collides_with_existing"
        THEN ranked."proposed_label"
      ELSE ranked."proposed_label" || ' [' || ranked."id" || ']'
    END
    FROM ranked
    WHERE up."id" = ranked."id"
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
