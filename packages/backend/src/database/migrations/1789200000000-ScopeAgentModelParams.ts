import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a route-scope dimension to model params so the same provider/auth/model
 * can be configured differently in complexity tiers, task-specific tiers, and
 * header tiers.
 */
export class ScopeAgentModelParams1789200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_model_params"
      ADD COLUMN IF NOT EXISTS "scope_key" varchar
    `);

    await queryRunner.query(`
      UPDATE "agent_model_params"
      SET "scope_key" = '__legacy__'
      WHERE "scope_key" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_model_params_route"`);

    await queryRunner.query(`
      WITH route_sources AS (
        SELECT
          agent_id,
          'tier:' || tier AS scope_key,
          COALESCE(override_route, auto_assigned_route) AS primary_route,
          fallback_routes
        FROM tier_assignments
        UNION ALL
        SELECT
          agent_id,
          'specificity:' || category AS scope_key,
          COALESCE(override_route, auto_assigned_route) AS primary_route,
          fallback_routes
        FROM specificity_assignments
        UNION ALL
        SELECT
          agent_id,
          'header:' || id AS scope_key,
          override_route AS primary_route,
          fallback_routes
        FROM header_tiers
      ),
      primary_routes AS (
        SELECT
          agent_id,
          scope_key,
          LOWER(primary_route->>'provider') AS provider,
          primary_route->>'authType' AS auth_type,
          primary_route->>'model' AS model_name
        FROM route_sources
        WHERE primary_route IS NOT NULL
          AND jsonb_typeof(primary_route) = 'object'
          AND primary_route ? 'provider'
          AND primary_route ? 'authType'
          AND primary_route ? 'model'
      ),
      fallback_routes AS (
        SELECT
          rs.agent_id,
          rs.scope_key,
          LOWER(fr->>'provider') AS provider,
          fr->>'authType' AS auth_type,
          fr->>'model' AS model_name
        FROM route_sources rs
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(rs.fallback_routes) = 'array' THEN rs.fallback_routes
            ELSE '[]'::jsonb
          END
        ) AS arr(fr)
        WHERE rs.fallback_routes IS NOT NULL
          AND jsonb_typeof(rs.fallback_routes) = 'array'
          AND jsonb_typeof(fr) = 'object'
          AND fr ? 'provider'
          AND fr ? 'authType'
          AND fr ? 'model'
      ),
      route_rows AS (
        SELECT DISTINCT * FROM primary_routes
        UNION
        SELECT DISTINCT * FROM fallback_routes
      ),
      legacy_rows AS (
        SELECT *
        FROM "agent_model_params"
        WHERE scope_key = '__legacy__'
      )
      INSERT INTO "agent_model_params" (
        "id",
        "user_id",
        "agent_id",
        "scope_key",
        "provider",
        "auth_type",
        "model_name",
        "params",
        "created_at",
        "updated_at"
      )
      SELECT
        gen_random_uuid()::text,
        p.user_id,
        p.agent_id,
        r.scope_key,
        p.provider,
        p.auth_type,
        p.model_name,
        p.params,
        p.created_at,
        now()
      FROM legacy_rows p
      JOIN route_rows r
        ON r.agent_id = p.agent_id
       AND r.provider = LOWER(p.provider)
       AND r.auth_type = p.auth_type
       AND r.model_name = p.model_name
    `);

    await queryRunner.query(`
      WITH route_sources AS (
        SELECT
          agent_id,
          COALESCE(override_route, auto_assigned_route) AS primary_route,
          fallback_routes
        FROM tier_assignments
        UNION ALL
        SELECT
          agent_id,
          COALESCE(override_route, auto_assigned_route) AS primary_route,
          fallback_routes
        FROM specificity_assignments
        UNION ALL
        SELECT
          agent_id,
          override_route AS primary_route,
          fallback_routes
        FROM header_tiers
      ),
      primary_routes AS (
        SELECT
          agent_id,
          LOWER(primary_route->>'provider') AS provider,
          primary_route->>'authType' AS auth_type,
          primary_route->>'model' AS model_name
        FROM route_sources
        WHERE primary_route IS NOT NULL
          AND jsonb_typeof(primary_route) = 'object'
          AND primary_route ? 'provider'
          AND primary_route ? 'authType'
          AND primary_route ? 'model'
      ),
      fallback_routes AS (
        SELECT
          rs.agent_id,
          LOWER(fr->>'provider') AS provider,
          fr->>'authType' AS auth_type,
          fr->>'model' AS model_name
        FROM route_sources rs
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(rs.fallback_routes) = 'array' THEN rs.fallback_routes
            ELSE '[]'::jsonb
          END
        ) AS arr(fr)
        WHERE rs.fallback_routes IS NOT NULL
          AND jsonb_typeof(rs.fallback_routes) = 'array'
          AND jsonb_typeof(fr) = 'object'
          AND fr ? 'provider'
          AND fr ? 'authType'
          AND fr ? 'model'
      ),
      route_rows AS (
        SELECT DISTINCT * FROM primary_routes
        UNION
        SELECT DISTINCT * FROM fallback_routes
      )
      DELETE FROM "agent_model_params" p
      USING route_rows r
      WHERE p.scope_key = '__legacy__'
        AND r.agent_id = p.agent_id
        AND r.provider = LOWER(p.provider)
        AND r.auth_type = p.auth_type
        AND r.model_name = p.model_name
    `);

    await queryRunner.query(`
      UPDATE "agent_model_params"
      SET "scope_key" = 'tier:default'
      WHERE "scope_key" = '__legacy__'
    `);

    await queryRunner.query(`
      ALTER TABLE "agent_model_params"
      ALTER COLUMN "scope_key" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_model_params_route"
      ON "agent_model_params" ("agent_id", "scope_key", "provider", "model_name", "auth_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_model_params_route"`);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY agent_id, provider, auth_type, model_name
            ORDER BY updated_at DESC, id DESC
          ) AS row_rank
        FROM "agent_model_params"
      )
      DELETE FROM "agent_model_params" p
      USING ranked r
      WHERE p.id = r.id
        AND r.row_rank > 1
    `);

    await queryRunner.query(`
      ALTER TABLE "agent_model_params"
      DROP COLUMN IF EXISTS "scope_key"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_model_params_route"
      ON "agent_model_params" ("agent_id", "provider", "auth_type", "model_name")
    `);
  }
}
