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

    // 4. Disambiguate rows that collide on the new user-scoped uniqueness key
    //    (user_id, provider, auth_type, LOWER(label)) by RELABELING, never
    //    deleting. The common pre-PR state is the same api key connected to N
    //    agents: N rows, all label 'Default', different agent_id. They collide
    //    on the new index. We CANNOT merge them safely — keys are AES-256-GCM
    //    with a random IV (crypto.util.ts), so the same plaintext key has
    //    different ciphertext on every row and pure SQL can't prove equality.
    //    Deleting "duplicates" would silently drop a distinct key in the case
    //    where two agents genuinely hold different keys under the same label.
    //    Instead, keep the lowest-priority row's label and suffix every other
    //    colliding row with its own (globally unique) id, so every key survives
    //    and the unique index in step 6 holds. The agent_provider_access rows
    //    inserted in step 3 already point each agent at its own row, so they
    //    stay correct — no reassignment needed. Worst case is a few near-
    //    identical entries the user can tidy up; no key is ever lost.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          "label",
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
