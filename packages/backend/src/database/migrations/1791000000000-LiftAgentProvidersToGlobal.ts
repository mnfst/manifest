import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiftAgentProvidersToGlobal1791000000000 implements MigrationInterface {
  name = 'LiftAgentProvidersToGlobal1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the old agent-scoped unique index (it references agent_id).
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"`);

    // 2. Allow global provider rows by relaxing the legacy NOT NULL constraint.
    //    We keep the agent_id column and its values around — this migration
    //    never nulls agent_id — so the relabel CTE below can still JOIN agents.
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" DROP NOT NULL`);

    // 3. Disambiguate rows that collide on the new user-scoped uniqueness key
    //    (user_id, provider, auth_type, LOWER(label)) by RELABELING, never
    //    deleting. Keys are AES-256-GCM with a random IV so SQL can't prove two
    //    rows hold the same plaintext key; deleting "duplicates" would silently
    //    drop a distinct key. For old agent-scoped "Default" connections, use
    //    the agent display name so the global connection keeps its source
    //    context. Custom labels keep the user's label and append the source
    //    agent name. If the generated label is still not unique, choose the
    //    first row-id suffix that does not collide with pre-existing labels.
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
        COUNT(*) OVER (
          PARTITION BY p."user_id", p."provider", p."auth_type", LOWER(p."proposed_label")
        ) AS "proposed_count",
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
    ),
    candidate_reserved_labels AS (
      SELECT
        "id",
        "user_id",
        "provider",
        "auth_type",
        LOWER("proposed_label") AS "label_key"
      FROM proposed
      UNION ALL
      SELECT
        p."id",
        p."user_id",
        p."provider",
        p."auth_type",
        LOWER(
          CASE
            WHEN suffix.n = 1 THEN p."proposed_label" || ' [' || p."id" || ']'
            ELSE p."proposed_label" || ' [' || p."id" || '-' || suffix.n || ']'
          END
        ) AS "label_key"
      FROM proposed p
      CROSS JOIN generate_series(1, 1000) AS suffix(n)
    ),
    resolved AS (
      SELECT ranked."id", chosen."label"
      FROM ranked
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN suffix.n = 0 THEN ranked."proposed_label"
          WHEN suffix.n = 1 THEN ranked."proposed_label" || ' [' || ranked."id" || ']'
          ELSE ranked."proposed_label" || ' [' || ranked."id" || '-' || suffix.n || ']'
        END AS "label"
        FROM generate_series(0, 1000) AS suffix(n)
        WHERE (
          suffix.n > 0
          OR (ranked."proposed_count" = 1 AND NOT ranked."collides_with_existing")
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "user_providers" existing
          WHERE existing."user_id" = ranked."user_id"
            AND existing."provider" = ranked."provider"
            AND existing."auth_type" IS NOT DISTINCT FROM ranked."auth_type"
            AND NOT EXISTS (
              SELECT 1 FROM proposed p2 WHERE p2."id" = existing."id"
            )
            AND LOWER(existing."label") = LOWER(
              CASE
                WHEN suffix.n = 0 THEN ranked."proposed_label"
                WHEN suffix.n = 1 THEN ranked."proposed_label" || ' [' || ranked."id" || ']'
                ELSE ranked."proposed_label" || ' [' || ranked."id" || '-' || suffix.n || ']'
              END
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM candidate_reserved_labels reserved
          WHERE reserved."id" <> ranked."id"
            AND reserved."user_id" = ranked."user_id"
            AND reserved."provider" = ranked."provider"
            AND reserved."auth_type" IS NOT DISTINCT FROM ranked."auth_type"
            AND reserved."label_key" = LOWER(
              CASE
                WHEN suffix.n = 0 THEN ranked."proposed_label"
                WHEN suffix.n = 1 THEN ranked."proposed_label" || ' [' || ranked."id" || ']'
                ELSE ranked."proposed_label" || ' [' || ranked."id" || '-' || suffix.n || ']'
              END
            )
        )
        ORDER BY suffix.n
        LIMIT 1
      ) chosen
    )
    UPDATE "user_providers" up
    SET "label" = resolved."label"
    FROM resolved
    WHERE up."id" = resolved."id"
  `);

    // 4. Create the new user-scoped unique index.
    await queryRunner.query(`
    CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"
    ON "user_providers" ("user_id", "provider", "auth_type", LOWER("label"))
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"`);
    await queryRunner.query(`
    CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"
    ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
  `);
    // Intentionally NOT re-adding NOT NULL on agent_id: post-migration global
    // provider rows legitimately have NULL agent_id, so restoring the
    // constraint would reject valid rows. The relaxed column stays relaxed.
  }
}
