import { QueryRunner } from 'typeorm';
import { CleanupOrphanedCustomProviderRefs1776679833383 } from './1776679833383-CleanupOrphanedCustomProviderRefs';

type Row = {
  id: string;
  override_model: string | null;
  override_provider: string | null;
  fallback_models: string | null;
};

function makeQueryRunner(options: {
  existingCustomIds: string[];
  tierRows?: Row[];
  specificityRows?: Row[];
}) {
  const updates: { table: string; sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    const trimmed = sql.trim();
    if (trimmed.startsWith('SELECT id FROM custom_providers')) {
      return options.existingCustomIds.map((id) => ({ id }));
    }
    if (trimmed.startsWith('SELECT id, override_model')) {
      if (sql.includes('tier_assignments')) return options.tierRows ?? [];
      if (sql.includes('specificity_assignments')) return options.specificityRows ?? [];
    }
    if (trimmed.startsWith('UPDATE')) {
      const table = sql.includes('tier_assignments')
        ? 'tier_assignments'
        : 'specificity_assignments';
      updates.push({ table, sql, params: params ?? [] });
    }
    return undefined;
  });
  return { query, updates };
}

describe('CleanupOrphanedCustomProviderRefs1776679833383', () => {
  let migration: CleanupOrphanedCustomProviderRefs1776679833383;

  beforeEach(() => {
    migration = new CleanupOrphanedCustomProviderRefs1776679833383();
  });

  it('clears tier overrides whose custom provider no longer exists', async () => {
    const { query, updates } = makeQueryRunner({
      existingCustomIds: ['still-here'],
      tierRows: [
        {
          id: 'tier-1',
          override_model: 'custom:gone/gemini',
          override_provider: 'custom:gone',
          fallback_models: null,
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    const tierUpdates = updates.filter((u) => u.table === 'tier_assignments');
    expect(tierUpdates).toHaveLength(1);
    expect(tierUpdates[0].params.slice(0, 3)).toEqual([null, null, null]);
  });

  it('clears specificity overrides whose custom provider no longer exists', async () => {
    const { query, updates } = makeQueryRunner({
      existingCustomIds: [],
      specificityRows: [
        {
          id: 'spec-1',
          override_model: 'custom:gone/gemini',
          override_provider: 'custom:gone',
          fallback_models: null,
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    const specUpdates = updates.filter((u) => u.table === 'specificity_assignments');
    expect(specUpdates).toHaveLength(1);
  });

  it('leaves overrides alone when the custom provider still exists', async () => {
    const { query, updates } = makeQueryRunner({
      existingCustomIds: ['alive'],
      tierRows: [
        {
          id: 'tier-1',
          override_model: 'custom:alive/gemini',
          override_provider: 'custom:alive',
          fallback_models: null,
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    expect(updates).toHaveLength(0);
  });

  it('filters fallback_models entries pointing to deleted custom providers', async () => {
    const { query, updates } = makeQueryRunner({
      existingCustomIds: ['alive'],
      tierRows: [
        {
          id: 'tier-1',
          override_model: null,
          override_provider: null,
          fallback_models: JSON.stringify(['custom:gone/a', 'custom:alive/b', 'openai/gpt-4o']),
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    const tierUpdates = updates.filter((u) => u.table === 'tier_assignments');
    expect(tierUpdates).toHaveLength(1);
    const updated = JSON.parse(tierUpdates[0].params[0] as string);
    expect(updated).toEqual(['custom:alive/b', 'openai/gpt-4o']);
  });

  it('sets fallback_models to null when all entries are orphaned', async () => {
    const { query, updates } = makeQueryRunner({
      existingCustomIds: [],
      tierRows: [
        {
          id: 'tier-1',
          override_model: null,
          override_provider: null,
          fallback_models: JSON.stringify(['custom:gone/a']),
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    const tierUpdates = updates.filter((u) => u.table === 'tier_assignments');
    expect(tierUpdates[0].params[0]).toBeNull();
  });

  it('ignores malformed fallback_models JSON without crashing', async () => {
    const { query, updates } = makeQueryRunner({
      existingCustomIds: [],
      tierRows: [
        {
          id: 'tier-1',
          override_model: null,
          override_provider: null,
          fallback_models: 'not json',
        },
      ],
    });

    await expect(migration.up({ query } as unknown as QueryRunner)).resolves.toBeUndefined();
    expect(updates).toHaveLength(0);
  });

  it('keeps non-string entries in fallback_models untouched', async () => {
    // Guards against a fallback_models payload that somehow contains objects / numbers;
    // we should pass them through instead of filtering them out or crashing.
    const { query, updates } = makeQueryRunner({
      existingCustomIds: [],
      tierRows: [
        {
          id: 'tier-1',
          override_model: null,
          override_provider: null,
          fallback_models: JSON.stringify([{ weird: true }, 42, 'custom:gone/a']),
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    const tierUpdates = updates.filter((u) => u.table === 'tier_assignments');
    expect(tierUpdates).toHaveLength(1);
    const updated = JSON.parse(tierUpdates[0].params[0] as string);
    expect(updated).toEqual([{ weird: true }, 42]);
  });

  it('leaves overrides with non-custom providers untouched (extractCustomIdFromProvider short-circuit)', async () => {
    // override_provider = "anthropic" does NOT start with "custom:" — nothing to clear.
    // This row only lands in the SELECT because its fallback_models contains 'custom:...'.
    const { query, updates } = makeQueryRunner({
      existingCustomIds: ['alive'],
      tierRows: [
        {
          id: 'tier-1',
          override_model: 'anthropic/claude-opus-4',
          override_provider: 'anthropic',
          fallback_models: JSON.stringify(['custom:alive/b']),
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    // override stays intact; fallback_models unchanged (all entries still point to live providers)
    expect(updates).toHaveLength(0);
  });

  it('treats "custom:" with empty id as not-a-custom-ref and leaves the row alone', async () => {
    // Defensive: extractCustomIdFromProvider/Model both return null when the id portion
    // is empty. Such a row should not be touched even if existingIds is empty.
    const { query, updates } = makeQueryRunner({
      existingCustomIds: [],
      tierRows: [
        {
          id: 'tier-1',
          override_model: 'custom:',
          override_provider: 'custom:',
          fallback_models: null,
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    expect(updates).toHaveLength(0);
  });

  it('extracts custom id from a bare "custom:<id>" model string (no slash)', async () => {
    // Covers extractCustomIdFromModel's no-slash branch: entry is just "custom:uuid"
    // without a trailing "/<model>". Such an entry must still be detected and filtered.
    const { query, updates } = makeQueryRunner({
      existingCustomIds: [],
      tierRows: [
        {
          id: 'tier-1',
          override_model: null,
          override_provider: null,
          fallback_models: JSON.stringify(['custom:gone', 'openai/gpt-4o']),
        },
      ],
    });

    await migration.up({ query } as unknown as QueryRunner);

    const tierUpdates = updates.filter((u) => u.table === 'tier_assignments');
    expect(tierUpdates).toHaveLength(1);
    const updated = JSON.parse(tierUpdates[0].params[0] as string);
    expect(updated).toEqual(['openai/gpt-4o']);
  });

  it('down() is a no-op', async () => {
    await expect(migration.down()).resolves.toBeUndefined();
  });
});
