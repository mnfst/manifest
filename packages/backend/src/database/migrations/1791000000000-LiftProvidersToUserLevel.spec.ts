import { LiftProvidersToUserLevel1791000000000 } from './1791000000000-LiftProvidersToUserLevel';

describe('LiftProvidersToUserLevel1791000000000', () => {
  const migration = new LiftProvidersToUserLevel1791000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('creates provider access, relabels colliding connections, keeps agent_id, and swaps the index', async () => {
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
    const relabel = queries.find((q) => q.includes('WITH colliding_labels AS'));
    expect(relabel).toBeDefined();
    expect(relabel).toContain('WITH colliding_labels AS');
    expect(relabel).toContain('HAVING COUNT(*) > 1');
    expect(relabel).toContain('LEFT JOIN "agents" a ON a."id" = up."agent_id"');
    expect(relabel).toContain('NULLIF(TRIM(a."display_name"), \'\')');
    expect(relabel).toContain('NULLIF(TRIM(a."name"), \'\')');
    expect(relabel).toContain('WHEN LOWER("label") = \'default\' THEN "agent_label"');
    expect(relabel).toContain('ELSE "label" || \' - \' || "agent_label"');
    expect(relabel).toContain('generate_series(0, 1000)');
    expect(relabel).toContain('candidate_reserved_labels AS');
    expect(relabel).toContain('ranked."proposed_label" || \' [\' || ranked."id" || \']\'');
    expect(relabel).toContain(
      "ranked.\"proposed_label\" || ' [' || ranked.\"id\" || '-' || suffix.n || ']'",
    );
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

  it('drops the old index before relabeling, then creates the new unique index', async () => {
    await migration.up(queryRunner);
    const dropOldIdx = queries.findIndex((q) =>
      q.includes('DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"'),
    );
    const relabelIdx = queries.findIndex((q) => q.includes('WITH colliding_labels AS'));
    const createIdx = queries.findIndex((q) =>
      q.includes('CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"'),
    );
    expect(dropOldIdx).toBeGreaterThan(-1);
    expect(relabelIdx).toBeGreaterThan(-1);
    expect(relabelIdx).toBeGreaterThan(dropOldIdx);
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
