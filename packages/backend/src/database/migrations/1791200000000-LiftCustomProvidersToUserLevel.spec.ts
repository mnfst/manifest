import { LiftCustomProvidersToUserLevel1791200000000 } from './1791200000000-LiftCustomProvidersToUserLevel';

describe('LiftCustomProvidersToUserLevel1791200000000', () => {
  const migration = new LiftCustomProvidersToUserLevel1791200000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('drops the agent FK before dropping the column', async () => {
    await migration.up(queryRunner);
    const dropFk = queries.findIndex(
      (q) => q.includes('pg_constraint') && q.includes("contype = 'f'"),
    );
    const dropCol = queries.findIndex((q) => q.includes('DROP COLUMN IF EXISTS "agent_id"'));
    expect(dropFk).toBeGreaterThan(-1);
    expect(dropCol).toBeGreaterThan(dropFk);
  });

  it('relabels collisions on (user_id, LOWER(name)), drops agent_id, and creates the user-scoped unique index', async () => {
    await migration.up(queryRunner);
    const relabel = queries.find((q) => q.includes('ROW_NUMBER() OVER'));
    expect(relabel).toBeDefined();
    expect(relabel).toContain('PARTITION BY "user_id", LOWER("name")');
    expect(relabel).toContain('r."name" || \' [\' || r."id" || \']\'');
    // Collision-safe: pick a suffix not already taken within the user's names.
    expect(relabel).toContain('generate_series(0, 1000)');
    expect(relabel).toContain('NOT EXISTS');
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_custom_providers_user_name"') &&
          q.includes('("user_id", LOWER("name"))'),
      ),
    ).toBe(true);
  });

  it('backfills all-agent grants for existing custom providers', async () => {
    await migration.up(queryRunner);
    const backfill = queries.find(
      (q) => q.includes('INSERT INTO "agent_provider_access"') && q.includes("LIKE 'custom:%'"),
    );
    expect(backfill).toBeDefined();
    expect(backfill).toContain('ON CONFLICT DO NOTHING');
    expect(backfill).toContain('JOIN "agents" a');
    expect(backfill).toContain('a."deleted_at" IS NULL');
  });

  it('relabels BEFORE creating the unique index (so the index never fails on duplicates)', async () => {
    await migration.up(queryRunner);
    const relabelIdx = queries.findIndex((q) => q.includes('ROW_NUMBER() OVER'));
    const createIdx = queries.findIndex((q) =>
      q.includes('CREATE UNIQUE INDEX "IDX_custom_providers_user_name"'),
    );
    expect(relabelIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(relabelIdx);
  });

  it('never deletes a custom_providers row (encrypted-key safety invariant)', async () => {
    await migration.up(queryRunner);
    expect(queries.some((q) => /DELETE\s+FROM\s+"custom_providers"/i.test(q))).toBe(false);
  });

  it('down re-adds agent_id, restores the agent FK, and recreates the agent-scoped unique index', async () => {
    await migration.down(queryRunner);
    expect(queries.some((q) => q.includes('ADD COLUMN IF NOT EXISTS "agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('ADD CONSTRAINT "FK_custom_providers_agent"') &&
          q.includes('REFERENCES "agents"') &&
          q.includes('ON DELETE CASCADE'),
      ),
    ).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_custom_providers_agent_name"') &&
          q.includes('"agent_id"'),
      ),
    ).toBe(true);
  });

  it('down restores agent_id from the companion grant and never deletes a custom_providers row', async () => {
    await migration.down(queryRunner);
    expect(
      queries.some(
        (q) =>
          q.includes('UPDATE "custom_providers"') &&
          q.includes("'custom:' || cp.") &&
          q.includes('"agent_provider_access"'),
      ),
    ).toBe(true);
    expect(queries.some((q) => /DELETE\s+FROM\s+"custom_providers"/i.test(q))).toBe(false);
  });
});
