import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves outbound-request-body defaults (today: DeepSeek's `thinking` toggle)
 * from per-slot storage (`tier_assignments.param_defaults`,
 * `specificity_assignments.param_defaults`) to per-route storage on a new
 * `agent_model_params` table keyed by `(agent_id, provider, auth_type,
 * model_name)`.
 *
 * Rationale: a `thinking` setting describes how to talk to a specific model,
 * not how a routing slot behaves. Storing it on the slot meant a user who
 * configured DeepSeek thinking off on the `simple` tier was silently re-
 * configuring it the moment DeepSeek showed up as a fallback in another
 * slot. Storing it on the route makes the config travel with the model
 * everywhere it appears (default tier primary, specificity fallback, header
 * tier, etc.) and removes the per-provider filter that was guarding against
 * cross-provider leaks.
 *
 * Backfill walks every legacy `param_defaults` row and writes one row per
 * compatible route — the effective primary (override > auto) plus every
 * fallback_route — when the route's provider is known to consume any key
 * present in the blob. Today that means `deepseek` for the `thinking` key;
 * this migration mirrored the then-current DeepSeek-only registry as a
 * literal because migrations run before the runtime app boots. Newer
 * provider knobs are represented by the MPS catalog rather than retroactive
 * slot migration.
 *
 * Conflict resolution: a given (agent, provider, auth_type, model_name) can
 * appear in multiple slots (e.g. as fallback in two tiers). Postgres cannot
 * `ON CONFLICT DO UPDATE` the same target row twice in one statement, so the
 * source stream is de-duped before the INSERT. The selected row is stable:
 * tier_assignments are processed before specificity_assignments, fallback
 * routes win over primaries inside a source table, and later source row IDs
 * break any remaining tie.
 *
 * This migration intentionally keeps the legacy `param_defaults` columns.
 * Railway runs migrations while the old deployment can still be serving
 * traffic, so the expand step must remain backward-compatible. A later
 * cleanup migration can drop those columns once the new code has been live.
 */
export class AddAgentModelParams1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the new per-route params table -----------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_model_params" (
        "id" varchar PRIMARY KEY,
        "user_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "auth_type" varchar NOT NULL,
        "model_name" varchar NOT NULL,
        "params" jsonb NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_model_params_route"
      ON "agent_model_params" ("agent_id", "provider", "auth_type", "model_name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_model_params_agent"
      ON "agent_model_params" ("agent_id")
    `);

    // 2. Backfill from legacy `param_defaults` blobs -----------------------
    // Legacy provider-key compatibility is mirrored as a literal so the data
    // move doesn't depend on importing runtime code.
    // When a new provider knob lands, append its provider→key mapping below
    // — historical user_providers won't be retroactively backfilled (the
    // legacy blob never knew about that key) but new writes will populate
    // through the runtime path.
    const PROVIDERS_WITH_THINKING = ['deepseek'];

    // Tier and specificity assignments share the same shape (override_route,
    // auto_assigned_route, fallback_routes, param_defaults). The CTE below
    // unifies them into a single flat stream of (agent, route, params)
    // tuples for the eventual INSERT.
    for (const sourceTable of ['tier_assignments', 'specificity_assignments']) {
      // `deduped` keeps one row per target route before the INSERT. This
      // avoids Postgres' cardinality violation when the same model appears in
      // multiple slots while preserving the old stable last-write behavior.
      await queryRunner.query(`
        WITH source_rows AS (
          SELECT
            t.user_id,
            t.agent_id,
            t.id AS source_id,
            t.param_defaults,
            -- effective primary: override wins over auto-assigned
            COALESCE(t.override_route, t.auto_assigned_route) AS primary_route,
            t.fallback_routes
          FROM "${sourceTable}" t
          WHERE t.param_defaults IS NOT NULL
            AND jsonb_typeof(t.param_defaults) = 'object'
        ),
        primary_rows AS (
          SELECT
            s.user_id,
            s.agent_id,
            s.source_id,
            s.param_defaults,
            (s.primary_route->>'provider') AS provider,
            (s.primary_route->>'authType') AS auth_type,
            (s.primary_route->>'model') AS model_name,
            0 AS slot_priority
          FROM source_rows s
          WHERE s.primary_route IS NOT NULL
            AND jsonb_typeof(s.primary_route) = 'object'
            AND s.primary_route ? 'provider'
            AND s.primary_route ? 'authType'
            AND s.primary_route ? 'model'
        ),
        fallback_rows AS (
          SELECT
            s.user_id,
            s.agent_id,
            s.source_id,
            s.param_defaults,
            (fr->>'provider') AS provider,
            (fr->>'authType') AS auth_type,
            (fr->>'model') AS model_name,
            1 + (fr_idx - 1) AS slot_priority
          FROM source_rows s
          CROSS JOIN LATERAL jsonb_array_elements(s.fallback_routes)
            WITH ORDINALITY AS arr(fr, fr_idx)
          WHERE s.fallback_routes IS NOT NULL
            AND jsonb_typeof(s.fallback_routes) = 'array'
            AND jsonb_typeof(fr) = 'object'
            AND fr ? 'provider'
            AND fr ? 'authType'
            AND fr ? 'model'
        ),
        combined AS (
          SELECT * FROM primary_rows
          UNION ALL
          SELECT * FROM fallback_rows
        ),
        compatible AS (
          -- Keep rows where the route's provider consumes at least one key
          -- in the param_defaults blob. Today only DeepSeek consumes
          -- thinking; expand the OR chain when new provider/key pairs
          -- land. Filter at the row level (not per-key) because the JSONB
          -- column is a wide bag and the runtime cleanly ignores keys it
          -- doesn't recognize.
          SELECT
            user_id,
            agent_id,
            source_id,
            param_defaults,
            LOWER(provider) AS provider,
            auth_type,
            model_name,
            slot_priority
          FROM combined
          WHERE LOWER(provider) IN (${PROVIDERS_WITH_THINKING.map((p) => `'${p}'`).join(', ')})
            AND param_defaults ? 'thinking'
        ),
        deduped AS (
          SELECT
            user_id,
            agent_id,
            param_defaults,
            provider,
            auth_type,
            model_name,
            ROW_NUMBER() OVER (
              PARTITION BY agent_id, provider, auth_type, model_name
              ORDER BY slot_priority DESC, source_id DESC
            ) AS route_rank
          FROM compatible
        )
        INSERT INTO "agent_model_params" (
          "id",
          "user_id",
          "agent_id",
          "provider",
          "auth_type",
          "model_name",
          "params",
          "created_at",
          "updated_at"
        )
        SELECT
          gen_random_uuid()::text,
          user_id,
          agent_id,
          provider,
          auth_type,
          model_name,
          -- Project the blob to only the keys the route's provider consumes.
          -- For DeepSeek today, that's thinking. Anything else stays
          -- stripped so a stray legacy field can't poison outbound requests.
          jsonb_build_object('thinking', param_defaults->'thinking'),
          now(),
          now()
        FROM deduped
        WHERE route_rank = 1
        ON CONFLICT (agent_id, provider, auth_type, model_name)
        DO UPDATE SET
          params = EXCLUDED.params,
          updated_at = now()
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `up` is additive and leaves legacy columns in place, so rollback only
    // needs to remove the new route-scoped table and indexes.
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_model_params_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_model_params_route"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_model_params"`);
  }
}
