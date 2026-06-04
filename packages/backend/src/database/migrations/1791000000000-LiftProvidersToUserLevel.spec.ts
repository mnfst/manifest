import { LiftProvidersToUserLevel1791000000000 } from './1791000000000-LiftProvidersToUserLevel';

describe('LiftProvidersToUserLevel1791000000000', () => {
  const migration = new LiftProvidersToUserLevel1791000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('creates provider access, relabels safely, keeps agent_id, and swaps the index', async () => {
    await migration.up(queryRunner);
    expect(
      queries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS "agent_provider_access"')),
    ).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('INSERT INTO "agent_provider_access"') && q.includes('FROM "user_providers"'),
      ),
    ).toBe(true);
    expect(queries.some((q) => q.includes('ALTER COLUMN "agent_id" DROP NOT NULL'))).toBe(true);
    const relabel = queries.find((q) => q.includes('ROW_NUMBER() OVER'));
    expect(relabel).toBeDefined();
    expect(relabel).toContain('PARTITION BY "user_id", "provider", "auth_type", LOWER("label")');
    expect(relabel).not.toContain('"api_key_encrypted"');
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "agent_id"'))).toBe(false);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"') &&
          q.includes('LOWER("label")'),
      ),
    ).toBe(true);
  });

  it('never deletes a provider row', async () => {
    await migration.up(queryRunner);
    expect(queries.some((q) => /DELETE\s+FROM\s+"user_providers"/i.test(q))).toBe(false);
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

  it('down restores agent_id strictness, the agent-scoped index, and drops access', async () => {
    await migration.down(queryRunner);
    expect(queries.some((q) => q.includes('SET "agent_id" = sub.agent_id'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth_label"') &&
          q.includes('"agent_id"'),
      ),
    ).toBe(true);
    expect(queries.some((q) => q.includes('ALTER COLUMN "agent_id" SET NOT NULL'))).toBe(true);
    expect(queries.some((q) => q.includes('DROP TABLE IF EXISTS "agent_provider_access"'))).toBe(
      true,
    );
  });
});
