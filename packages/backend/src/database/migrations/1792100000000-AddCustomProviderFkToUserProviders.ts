import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A custom provider is two rows kept in sync by application code only: a
 * `custom_providers` row (config) and a companion `user_providers` row whose
 * `provider` column embeds the id as `'custom:<uuid>'`. That string is an
 * application-enforced foreign key — deleting a custom provider could leave a
 * ghost `user_providers` row (with an orphaned encrypted key) behind, and
 * nothing at the DB level prevented inserting a companion row for a custom
 * provider that doesn't exist (see #1603 for the orphan class this caused in
 * routing config).
 *
 * This migration makes Postgres own that edge without changing the wire
 * format: a STORED generated column extracts the embedded id from `provider`,
 * and a real FK with ON DELETE CASCADE points it at `custom_providers(id)`.
 * Application code keeps reading/writing the `provider` string exactly as
 * before — the generated column is maintained by Postgres and never written
 * by TypeORM (it is intentionally absent from the UserProvider entity).
 *
 * Orphan `user_providers` rows that already point at a deleted custom
 * provider are removed first: they are unresolvable (provider resolution
 * looks up the custom_providers row, which is gone), invisible in the UI,
 * and would block the FK from validating. No reachable data is touched.
 */
export class AddCustomProviderFkToUserProviders1792100000000 implements MigrationInterface {
  name = 'AddCustomProviderFkToUserProviders1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop unresolvable companion rows so the FK can validate. The cascade
    //    on agent_enabled_providers.user_provider_id cleans their grants.
    await queryRunner.query(`
      DELETE FROM "user_providers"
      WHERE "provider" LIKE 'custom:%'
        AND NOT EXISTS (
          SELECT 1 FROM "custom_providers" cp
          WHERE cp."id" = substring("user_providers"."provider" FROM 8)
        )
    `);

    // 2. Stored generated column mirroring the id embedded in `provider`.
    //    NULL for every non-custom provider row.
    await queryRunner.query(`
      ALTER TABLE "user_providers"
        ADD COLUMN "custom_provider_id" varchar
        GENERATED ALWAYS AS (
          CASE WHEN "provider" LIKE 'custom:%' THEN substring("provider" FROM 8) END
        ) STORED
    `);

    // 3. The actual integrity edge. CASCADE matches application semantics:
    //    CustomProviderService.remove() deletes both rows anyway — the FK is
    //    the backstop that makes a ghost companion row impossible.
    //    (ON UPDATE actions are not allowed on generated columns, but ids are
    //    immutable so none is needed.)
    await queryRunner.query(`
      ALTER TABLE "user_providers"
        ADD CONSTRAINT "FK_user_providers_custom_provider"
        FOREIGN KEY ("custom_provider_id") REFERENCES "custom_providers"("id")
        ON DELETE CASCADE
    `);

    // 4. Postgres doesn't index the referencing side of an FK — without this,
    //    every custom_providers delete seq-scans user_providers.
    await queryRunner.query(`
      CREATE INDEX "IDX_user_providers_custom_provider_id"
      ON "user_providers" ("custom_provider_id")
      WHERE "custom_provider_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_custom_provider_id"`);
    await queryRunner.query(
      `ALTER TABLE "user_providers" DROP CONSTRAINT IF EXISTS "FK_user_providers_custom_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_providers" DROP COLUMN IF EXISTS "custom_provider_id"`,
    );
    // The orphan rows deleted in up() are not restored: they pointed at
    // custom providers that no longer exist and cannot be reconstructed
    // (same stance as CleanupOrphanedCustomProviderRefs1776679833383).
  }
}
