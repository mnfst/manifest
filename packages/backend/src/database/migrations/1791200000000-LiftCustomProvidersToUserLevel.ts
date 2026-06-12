import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiftCustomProvidersToUserLevel1791200000000 implements MigrationInterface {
  name = 'LiftCustomProvidersToUserLevel1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop any FK on custom_providers.agent_id (name-agnostic) before the
    //    column goes away.
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = '"custom_providers"'::regclass AND contype = 'f'
        LOOP
          EXECUTE format('ALTER TABLE "custom_providers" DROP CONSTRAINT %I', c);
        END LOOP;
      END $$
    `);

    // 2. Drop every non-PK index on custom_providers (name-agnostic) — the old
    //    unique index was keyed on (agent_id, name).
    await queryRunner.query(`
      DO $$
      DECLARE i text;
      BEGIN
        FOR i IN
          SELECT i.relname
          FROM pg_index ix
          JOIN pg_class t ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          WHERE t.relname = 'custom_providers'
            AND ix.indisprimary = false
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', i);
        END LOOP;
      END $$
    `);

    // 3. Relabel name collisions within a user (suffix with row id — never
    //    delete: a custom provider row carries a base_url + model catalog the
    //    user configured, and two same-named rows under different agents are
    //    distinct configs we must preserve). Pick the first suffix that does
    //    NOT collide with an existing name for that user, so a user who already
    //    has a row literally named "Foo [<id>]" can't abort the migration on the
    //    new (user_id, LOWER(name)) unique index.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT "id", "user_id", "name",
          ROW_NUMBER() OVER (
            PARTITION BY "user_id", LOWER("name")
            ORDER BY "created_at" ASC, "id" ASC
          ) AS rn
        FROM "custom_providers"
      ),
      to_relabel AS (
        SELECT "id", "user_id", "name" FROM ranked WHERE rn > 1
      ),
      resolved AS (
        SELECT r."id", chosen."name"
        FROM to_relabel r
        CROSS JOIN LATERAL (
          SELECT CASE
                   WHEN suffix.n = 0 THEN r."name" || ' [' || r."id" || ']'
                   ELSE r."name" || ' [' || r."id" || '-' || suffix.n || ']'
                 END AS "name"
          FROM generate_series(0, 1000) AS suffix(n)
          WHERE NOT EXISTS (
            SELECT 1 FROM "custom_providers" existing
            WHERE existing."user_id" = r."user_id"
              AND existing."id" <> r."id"
              AND LOWER(existing."name") = LOWER(
                CASE
                  WHEN suffix.n = 0 THEN r."name" || ' [' || r."id" || ']'
                  ELSE r."name" || ' [' || r."id" || '-' || suffix.n || ']'
                END
              )
          )
          ORDER BY suffix.n
          LIMIT 1
        ) chosen
      )
      UPDATE "custom_providers" cp
      SET "name" = resolved."name"
      FROM resolved
      WHERE cp."id" = resolved."id"
    `);

    // 4. Drop the now-dead agent_id column. The custom_providers row's agent
    //    binding is gone; access is governed by the companion user_providers
    //    row's agent_provider_access grants (step 6). There's nothing to
    //    reconstruct the old mapping from on rollback, so keeping a nullable
    //    column buys no rollback safety — drop outright (matches #2061's schema).
    await queryRunner.query(`ALTER TABLE "custom_providers" DROP COLUMN IF EXISTS "agent_id"`);

    // 5. New user-scoped unique index.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_custom_providers_user_name"
      ON "custom_providers" ("user_id", LOWER("name"))
    `);

    // 6. Make every existing custom provider usable on ALL of its owner's agents.
    //    Pre-lift, a custom provider's companion user_providers row (`custom:<id>`)
    //    only carried the single agent_provider_access grant backfilled from its
    //    old agent_id. Now that custom providers are user-global — and newly
    //    created ones grant every agent via upsertProvider(null, ...) — backfill
    //    the same all-agent grants for existing ones, else they would show in
    //    every agent's list but only route on their original agent. Agents are
    //    owned via tenants.name = user_providers.user_id.
    await queryRunner.query(`
      INSERT INTO "agent_provider_access" ("agent_id", "user_provider_id")
      SELECT a."id", up."id"
      FROM "user_providers" up
      JOIN "tenants" t ON t."name" = up."user_id"
      JOIN "agents" a ON a."tenant_id" = t."id" AND a."deleted_at" IS NULL
      WHERE up."provider" LIKE 'custom:%'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_providers_user_name"`);
    await queryRunner.query(
      `ALTER TABLE "custom_providers" ADD COLUMN IF NOT EXISTS "agent_id" varchar`,
    );
    // Best-effort restore of each custom provider's agent binding from its
    // companion user_providers (custom:<id>) grant. agent_provider_access still
    // exists here because LiftProviders.down() (1791000…) runs AFTER this
    // migration's down() in revert order. Deterministic (earliest agent).
    // custom_providers rows are never deleted on rollback, so this is lossless
    // whether or not a binding is found; rows with no companion grant keep
    // agent_id = NULL (the column stays nullable — the pre-lift NOT NULL can't be
    // guaranteed for every row, and dropping data to satisfy it is not worth it).
    await queryRunner.query(`
      UPDATE "custom_providers" cp
      SET "agent_id" = (
        SELECT apa."agent_id"
        FROM "user_providers" up
        JOIN "agent_provider_access" apa ON apa."user_provider_id" = up."id"
        WHERE up."provider" = 'custom:' || cp."id"
        ORDER BY apa."agent_id"
        LIMIT 1
      )
      WHERE cp."agent_id" IS NULL
    `);
    // Restore the original agent FK (ON DELETE CASCADE) so the rolled-back schema
    // re-enforces referential integrity.
    await queryRunner.query(`
      ALTER TABLE "custom_providers"
        ADD CONSTRAINT "FK_custom_providers_agent"
        FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_custom_providers_agent_name"
      ON "custom_providers" ("agent_id", "name")
    `);
  }
}
