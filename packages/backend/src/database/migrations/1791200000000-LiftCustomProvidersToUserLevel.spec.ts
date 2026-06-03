import { LiftCustomProvidersToUserLevel1791200000000 } from './1791200000000-LiftCustomProvidersToUserLevel';

describe('LiftCustomProvidersToUserLevel1791200000000', () => {
  const migration = new LiftCustomProvidersToUserLevel1791200000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('relabels on user_id + name, drops agent_id, creates user-scoped unique index', async () => {
    await migration.up(queryRunner);
    const relabel = queries.find((q) => q.includes('ROW_NUMBER() OVER'));
    expect(relabel).toBeDefined();
    expect(relabel).toContain('PARTITION BY "user_id", LOWER("name")');
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_custom_providers_user_name"') &&
          q.includes('("user_id", LOWER("name"))'),
      ),
    ).toBe(true);
  });

  it('never deletes a custom_providers row', async () => {
    await migration.up(queryRunner);
    expect(queries.some((q) => /DELETE\s+FROM\s+"custom_providers"/i.test(q))).toBe(false);
  });

  it('relabels BEFORE creating the unique index', async () => {
    await migration.up(queryRunner);
    const relabelIdx = queries.findIndex((q) => q.includes('ROW_NUMBER() OVER'));
    const createIdx = queries.findIndex((q) =>
      q.includes('CREATE UNIQUE INDEX "IDX_custom_providers_user_name"'),
    );
    expect(relabelIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(relabelIdx);
  });

  it('down re-adds agent_id and recreates the agent-scoped index', async () => {
    await migration.down(queryRunner);
    expect(queries.some((q) => q.includes('ADD COLUMN IF NOT EXISTS "agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_custom_providers_agent_name"') &&
          q.includes('"agent_id"'),
      ),
    ).toBe(true);
  });
});
