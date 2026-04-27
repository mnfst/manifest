import { AddProviderKeyLabelAndPriority1782000000000 } from './1782000000000-AddProviderKeyLabelAndPriority';

describe('AddProviderKeyLabelAndPriority1782000000000', () => {
  const migration = new AddProviderKeyLabelAndPriority1782000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('up adds columns, backfills defaults, swaps unique index, and adds key-label columns', async () => {
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
    expect(
      queries.some((q) =>
        q.includes('"tier_assignments" ADD COLUMN IF NOT EXISTS "override_provider_key_label"'),
      ),
    ).toBe(true);
    expect(
      queries.some((q) =>
        q.includes(
          '"specificity_assignments" ADD COLUMN IF NOT EXISTS "override_provider_key_label"',
        ),
      ),
    ).toBe(true);
  });

  it('down reverses all up steps', async () => {
    await migration.down(queryRunner);
    expect(
      queries.some((q) =>
        q.includes('"specificity_assignments" DROP COLUMN IF EXISTS "override_provider_key_label"'),
      ),
    ).toBe(true);
    expect(
      queries.some((q) =>
        q.includes('"tier_assignments" DROP COLUMN IF EXISTS "override_provider_key_label"'),
      ),
    ).toBe(true);
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
