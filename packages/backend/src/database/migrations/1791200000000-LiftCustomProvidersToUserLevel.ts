import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiftCustomProvidersToUserLevel1791200000000 implements MigrationInterface {
  name = 'LiftCustomProvidersToUserLevel1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop any FK on custom_providers.agent_id (name-agnostic).
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

    // 3. Relabel name collisions within a user (suffix with row id — never delete).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT "id", "name",
          ROW_NUMBER() OVER (
            PARTITION BY "user_id", LOWER("name")
            ORDER BY "created_at" ASC, "id" ASC
          ) AS rn
        FROM "custom_providers"
      )
      UPDATE "custom_providers" cp
      SET "name" = ranked."name" || ' [' || ranked."id" || ']'
      FROM ranked
      WHERE cp."id" = ranked."id" AND ranked.rn > 1
    `);

    // 4. Drop the now-dead agent_id column.
    await queryRunner.query(`ALTER TABLE "custom_providers" DROP COLUMN IF EXISTS "agent_id"`);

    // 5. New user-scoped unique index.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_custom_providers_user_name"
      ON "custom_providers" ("user_id", LOWER("name"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_providers_user_name"`);
    await queryRunner.query(
      `ALTER TABLE "custom_providers" ADD COLUMN IF NOT EXISTS "agent_id" varchar`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_custom_providers_agent_name"
      ON "custom_providers" ("agent_id", "name")
    `);
  }
}
