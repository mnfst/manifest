import { LiftProvidersToUserLevel1791000000000 } from './1791000000000-LiftProvidersToUserLevel';

describe('LiftProvidersToUserLevel1791000000000', () => {
  const migration = new LiftProvidersToUserLevel1791000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('relabels on the index tuple (not the encrypted key), drops agent_id, swaps the index', async () => {
    await migration.up(queryRunner);
    const relabel = queries.find((q) => q.includes('ROW_NUMBER() OVER'));
    expect(relabel).toBeDefined();
    expect(relabel).toContain('PARTITION BY "user_id", "provider", "auth_type", LOWER("label")');
    expect(relabel).not.toContain('"api_key_encrypted"');
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"') &&
          q.includes('LOWER("label")'),
      ),
    ).toBe(true);
  });

  it('never deletes a provider row and never touches agent_provider_access', async () => {
    await migration.up(queryRunner);
    expect(queries.some((q) => /DELETE\s+FROM\s+"user_providers"/i.test(q))).toBe(false);
    expect(queries.some((q) => q.includes('agent_provider_access'))).toBe(false);
  });

  it('relabels BEFORE creating the unique index', async () => {
    await migration.up(queryRunner);
    const relabelIdx = queries.findIndex((q) => q.includes('ROW_NUMBER() OVER'));
    const createIdx = queries.findIndex((q) =>
      q.includes('CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"'),
    );
    expect(relabelIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(relabelIdx);
  });

  it('down re-adds agent_id and restores the agent-scoped index', async () => {
    await migration.down(queryRunner);
    expect(queries.some((q) => q.includes('ADD COLUMN IF NOT EXISTS "agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"') &&
          q.includes('"agent_id"'),
      ),
    ).toBe(true);
  });
});
