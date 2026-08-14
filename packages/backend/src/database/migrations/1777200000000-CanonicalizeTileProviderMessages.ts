import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rewrite `agent_messages.provider` + `.model` + `.fallback_from_model` for
 * tile-connected canonical providers (llama.cpp, LM Studio) so the messages
 * log / dashboard no longer exposes the internal `custom:<uuid>` scheme.
 *
 * A row qualifies when its `provider` is a `custom:<uuid>` key (or when the
 * model itself carries a `custom:<uuid>/` prefix — seen on
 * `fallback_from_model`) and the corresponding `custom_providers.name`
 * normalizes to a first-class tile-only entry in the shared provider
 * registry. Normalization here mirrors `normalizeProviderName` in
 * manifest-shared: lowercase + strip whitespace/dots/underscores/hyphens.
 *
 * The list of canonical tile ids is hard-coded on purpose — migrations
 * run before application code and cannot import runtime modules safely.
 * It stays in sync with `SHARED_PROVIDERS` entries whose `tileOnly: true`
 * flag is set.
 */
export class CanonicalizeTileProviderMessages1777200000000 implements MigrationInterface {
  name = 'CanonicalizeTileProviderMessages1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rewrite provider + model together for rows whose `provider` is a
    // `custom:<uuid>` pointing at a tile-only canonical. Covers the normal
    // success / failure rows the proxy writes for tile-connected servers.
    await queryRunner.query(
      `UPDATE "agent_messages" am
         SET
           "provider" = sub.canonical_id,
           "model" = CASE
             WHEN am.model LIKE 'custom:' || cp.id || '/%'
               THEN sub.canonical_id || '/' || SUBSTRING(am.model FROM LENGTH('custom:' || cp.id || '/') + 1)
             ELSE am.model
           END
         FROM "custom_providers" cp
         CROSS JOIN LATERAL (
           SELECT CASE lower(regexp_replace(cp.name, '[\\s._-]+', '', 'g'))
             WHEN 'llamacpp' THEN 'llamacpp'
             WHEN 'lmstudio' THEN 'lmstudio'
             ELSE NULL
           END AS canonical_id
         ) sub
         WHERE am."provider" = 'custom:' || cp.id
           AND sub.canonical_id IS NOT NULL`,
    );

    // Rewrite `fallback_from_model` independently — it's the only column
    // that can carry a `custom:<uuid>/model` string without a matching
    // provider on the same row (a cloud-provider fallback row whose primary
    // was a tile).
    await queryRunner.query(
      `UPDATE "agent_messages" am
         SET "fallback_from_model" =
           sub.canonical_id || '/' || SUBSTRING(am.fallback_from_model FROM LENGTH('custom:' || cp.id || '/') + 1)
         FROM "custom_providers" cp
         CROSS JOIN LATERAL (
           SELECT CASE lower(regexp_replace(cp.name, '[\\s._-]+', '', 'g'))
             WHEN 'llamacpp' THEN 'llamacpp'
             WHEN 'lmstudio' THEN 'lmstudio'
             ELSE NULL
           END AS canonical_id
         ) sub
         WHERE am."fallback_from_model" LIKE 'custom:' || cp.id || '/%'
           AND sub.canonical_id IS NOT NULL`,
    );
  }

  public async down(): Promise<void> {
    // Non-reversible: the source `custom:<uuid>` strings are not stored
    // anywhere else on the agent_messages row, and the UUID-to-name
    // mapping in `custom_providers` is still intact if a reverse migration
    // is ever needed. We intentionally leave `down()` as a no-op.
  }
}
