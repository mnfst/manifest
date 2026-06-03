import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiftProvidersToUserLevel1791000000000 implements MigrationInterface {
  name = 'LiftProvidersToUserLevel1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the agent_provider_access junction table
    await queryRunner.query(`
      CREATE TABLE "agent_provider_access" (
        "agent_id" varchar NOT NULL,
        "user_provider_id" varchar NOT NULL,
        CONSTRAINT "PK_agent_provider_access"
          PRIMARY KEY ("agent_id", "user_provider_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_provider_access_provider" ON "agent_provider_access" ("user_provider_id")`,
    );

    // 2. Make agent_id nullable on user_providers (providers become user-scoped)
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" DROP NOT NULL`);

    // 3. Populate agent_provider_access from existing data
    //    Every existing row gets an access entry for its current agent
    await queryRunner.query(`
      INSERT INTO "agent_provider_access" ("agent_id", "user_provider_id")
      SELECT "agent_id", "id"
      FROM "user_providers"
      WHERE "agent_id" IS NOT NULL
    `);

    // 4. Deduplicate: merge provider rows that collide on the new user-scoped
    //    uniqueness key (user_id, provider, auth_type, LOWER(label)) across
    //    different agents. We group by that exact tuple — NOT by
    //    api_key_encrypted — because keys are encrypted with a random IV
    //    (crypto.util.ts), so the same key yields different ciphertext on every
    //    row. Grouping on the ciphertext would never detect these as duplicates,
    //    leaving collisions that crash the unique index created in step 6.
    //    Keep the row with the lowest priority (earliest connected as tiebreak).
    //    Reassign access entries to the kept row, then delete duplicates.
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
        keep_id varchar;
        agent varchar;
      BEGIN
        -- Find groups that would violate the new unique index
        FOR rec IN
          SELECT
            "user_id", "provider", "auth_type", LOWER("label") AS label_key,
            array_agg("id" ORDER BY "priority" ASC, "connected_at" ASC) AS ids,
            array_agg(DISTINCT "agent_id") FILTER (WHERE "agent_id" IS NOT NULL) AS agents
          FROM "user_providers"
          WHERE "user_id" IS NOT NULL
          GROUP BY "user_id", "provider", "auth_type", LOWER("label")
          HAVING COUNT(*) > 1
        LOOP
          -- Keep the first row (lowest priority / earliest connected)
          keep_id := rec.ids[1];

          -- Ensure all agents have access to the kept row
          IF rec.agents IS NOT NULL THEN
            FOREACH agent IN ARRAY rec.agents LOOP
              INSERT INTO "agent_provider_access" ("agent_id", "user_provider_id")
              VALUES (agent, keep_id)
              ON CONFLICT DO NOTHING;
            END LOOP;
          END IF;

          -- Delete access entries pointing to duplicate rows
          DELETE FROM "agent_provider_access"
          WHERE "user_provider_id" = ANY(rec.ids[2:]);

          -- Delete the duplicate provider rows
          DELETE FROM "user_providers"
          WHERE "id" = ANY(rec.ids[2:]);
        END LOOP;
      END
      $$
    `);

    // 5. Drop the old agent-scoped unique index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);

    // 6. Create the new user-scoped unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"
      ON "user_providers" ("user_id", "provider", "auth_type", LOWER("label"))
    `);

    // 7. Clear agent_id on migrated rows (providers are now user-scoped)
    await queryRunner.query(
      `UPDATE "user_providers" SET "agent_id" = NULL WHERE "user_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore agent_id from access table (pick the first agent for each provider)
    await queryRunner.query(`
      UPDATE "user_providers" up
      SET "agent_id" = sub.agent_id
      FROM (
        SELECT DISTINCT ON ("user_provider_id") "user_provider_id", "agent_id"
        FROM "agent_provider_access"
        ORDER BY "user_provider_id", "agent_id"
      ) sub
      WHERE up."id" = sub."user_provider_id"
    `);

    // Drop the user-scoped unique index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"`);

    // Recreate the old agent-scoped unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"
      ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
    `);

    // Make agent_id NOT NULL again
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" SET NOT NULL`);

    // Drop the junction table
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_provider_access_provider"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_provider_access"`);
  }
}
