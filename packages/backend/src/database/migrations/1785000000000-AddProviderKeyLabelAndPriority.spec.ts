import { AddProviderKeyLabelAndPriority1785000000000 } from './1785000000000-AddProviderKeyLabelAndPriority';

describe('AddProviderKeyLabelAndPriority1785000000000', () => {
  const migration = new AddProviderKeyLabelAndPriority1785000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('up adds label/priority columns, backfills defaults, and swaps the unique index', async () => {
    await migration.up(queryRunner);
    expect(queries.some((q) => q.includes('ADD COLUMN IF NOT EXISTS "label"'))).toBe(true);
    expect(queries.some((q) => q.includes('ADD COLUMN IF NOT EXISTS "priority"'))).toBe(true);
    expect(queries.some((q) => q.includes(`SET "label" = 'Default'`))).toBe(true);
    expect(queries.some((q) => q.includes(`SET "priority" = 0`))).toBe(true);
    expect(queries.some((q) => q.includes('ALTER COLUMN "label" SET NOT NULL'))).toBe(true);
    expect(queries.some((q) => q.includes('ALTER COLUMN "priority" SET NOT NULL'))).toBe(true);
    expect(
      queries.some((q) =>
        q.includes('DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth"'),
      ),
    ).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"') &&
          q.includes('LOWER("label")'),
      ),
    ).toBe(true);
    // Pinned key labels live inside override_route / fallback_routes jsonb,
    // so this migration must NOT add new varchar columns to the assignment
    // tables.
    expect(queries.some((q) => q.includes('override_provider_key_label'))).toBe(false);
  });

  it('down reverses all up steps', async () => {
    await migration.down(queryRunner);
    expect(
      queries.some((q) =>
        q.includes('DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"'),
      ),
    ).toBe(true);
    expect(
      queries.some((q) =>
        q.includes('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth"'),
      ),
    ).toBe(true);
    // Multi-key dedup must run BEFORE recreating the stricter unique index,
    // otherwise the CREATE fails on any agent that has 2+ labeled keys for
    // one provider.
    const dedupIdx = queries.findIndex(
      (q) => q.includes('DELETE FROM "user_providers"') && q.includes('a.priority > b.priority'),
    );
    const stricterIdx = queries.findIndex((q) =>
      q.includes('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth"'),
    );
    expect(dedupIdx).toBeGreaterThan(-1);
    expect(stricterIdx).toBeGreaterThan(dedupIdx);
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "priority"'))).toBe(true);
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "label"'))).toBe(true);
  });
});
