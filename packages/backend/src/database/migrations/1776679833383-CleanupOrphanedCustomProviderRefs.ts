import { MigrationInterface, QueryRunner } from 'typeorm';

const CUSTOM_PROVIDER_PREFIX = 'custom:';

/**
 * Backfill cleanup for #1603.
 *
 * `tier_assignments` and `specificity_assignments` store custom provider
 * references as plain varchar / JSON text (no FK). Deleting a custom provider
 * used to leave behind orphan references — most visibly in specificity
 * assignments, where resolve() bypassed availability checks and pinned every
 * matching request to the dead provider. This migration finds all such
 * orphan references and clears them so existing affected agents recover
 * without manual DB intervention.
 */
export class CleanupOrphanedCustomProviderRefs1776679833383 implements MigrationInterface {
  name = 'CleanupOrphanedCustomProviderRefs1776679833383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing: { id: string }[] = await queryRunner.query('SELECT id FROM custom_providers');
    const existingIds = new Set(existing.map((row) => row.id));

    await this.cleanTable(queryRunner, 'tier_assignments', existingIds);
    await this.cleanTable(queryRunner, 'specificity_assignments', existingIds);
  }

  public async down(): Promise<void> {
    // No-op: cleared references cannot be reconstructed.
  }

  private async cleanTable(
    queryRunner: QueryRunner,
    table: string,
    existingIds: Set<string>,
  ): Promise<void> {
    const rows: {
      id: string;
      override_model: string | null;
      override_provider: string | null;
      fallback_models: string | null;
    }[] = await queryRunner.query(
      `SELECT id, override_model, override_provider, fallback_models
         FROM "${table}"
        WHERE override_provider LIKE $1
           OR override_model LIKE $1
           OR fallback_models LIKE $2`,
      [`${CUSTOM_PROVIDER_PREFIX}%`, `%${CUSTOM_PROVIDER_PREFIX}%`],
    );

    for (const row of rows) {
      let overrideModel = row.override_model;
      let overrideProvider = row.override_provider;
      let fallbackModels = row.fallback_models;
      let clearOverrideAuth = false;
      let changed = false;

      const overrideCustomId =
        extractCustomIdFromProvider(overrideProvider) ?? extractCustomIdFromModel(overrideModel);
      if (overrideCustomId && !existingIds.has(overrideCustomId)) {
        overrideModel = null;
        overrideProvider = null;
        clearOverrideAuth = true;
        changed = true;
      }

      if (fallbackModels) {
        try {
          const parsed = JSON.parse(fallbackModels);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((entry) => {
              if (typeof entry !== 'string') return true;
              const id = extractCustomIdFromModel(entry);
              return !id || existingIds.has(id);
            });
            if (filtered.length !== parsed.length) {
              fallbackModels = filtered.length > 0 ? JSON.stringify(filtered) : null;
              changed = true;
            }
          }
        } catch {
          // Leave malformed JSON untouched; log-only behavior isn't worth a crash here.
        }
      }

      if (!changed) continue;

      if (clearOverrideAuth) {
        await queryRunner.query(
          `UPDATE "${table}"
              SET override_model = $1,
                  override_provider = $2,
                  override_auth_type = NULL,
                  fallback_models = $3,
                  updated_at = NOW()
            WHERE id = $4`,
          [overrideModel, overrideProvider, fallbackModels, row.id],
        );
      } else {
        await queryRunner.query(
          `UPDATE "${table}"
              SET fallback_models = $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [fallbackModels, row.id],
        );
      }
    }
  }
}

function extractCustomIdFromProvider(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith(CUSTOM_PROVIDER_PREFIX)) return null;
  const id = value.slice(CUSTOM_PROVIDER_PREFIX.length);
  return id.length > 0 ? id : null;
}

function extractCustomIdFromModel(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith(CUSTOM_PROVIDER_PREFIX)) return null;
  const rest = value.slice(CUSTOM_PROVIDER_PREFIX.length);
  const slash = rest.indexOf('/');
  const id = slash === -1 ? rest : rest.slice(0, slash);
  return id.length > 0 ? id : null;
}
