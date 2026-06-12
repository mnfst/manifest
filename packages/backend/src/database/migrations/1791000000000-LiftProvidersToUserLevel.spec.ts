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
    expect(relabel).toContain('WHEN LOWER("label") = \'default\' THEN \'from \' || "agent_label"');
    expect(relabel).toContain('ELSE "label" || \' (from \' || "agent_label" || \')\'');
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
          q.includes('CREATE UNIQUE INDEX IF NOT EXISTS') &&
          q.includes('"IDX_user_providers_user_provider_auth_label"') &&
          q.includes('LOWER("label")'),
      ),
    ).toBe(true);
  });

  it('adds ON DELETE CASCADE foreign keys on the junction so grants cannot orphan', async () => {
    await migration.up(queryRunner);
    expect(
      queries.some(
        (q) =>
          q.includes('ADD CONSTRAINT "FK_agent_provider_access_agent"') &&
          q.includes('FOREIGN KEY ("agent_id") REFERENCES "agents" ("id")') &&
          q.includes('ON DELETE CASCADE'),
      ),
    ).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('ADD CONSTRAINT "FK_agent_provider_access_provider"') &&
          q.includes('FOREIGN KEY ("user_provider_id") REFERENCES "user_providers" ("id")') &&
          q.includes('ON DELETE CASCADE'),
      ),
    ).toBe(true);
    // FKs must be added after the table exists.
    const createTableIdx = queries.findIndex((q) =>
      q.includes('CREATE TABLE IF NOT EXISTS "agent_provider_access"'),
    );
    const agentFkIdx = queries.findIndex((q) =>
      q.includes('ADD CONSTRAINT "FK_agent_provider_access_agent"'),
    );
    expect(agentFkIdx).toBeGreaterThan(createTableIdx);
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
      q.includes('"IDX_user_providers_user_provider_auth_label"'),
    );
    expect(dropOldIdx).toBeGreaterThan(-1);
    expect(relabelIdx).toBeGreaterThan(-1);
    expect(relabelIdx).toBeGreaterThan(dropOldIdx);
    expect(createIdx).toBeGreaterThan(relabelIdx);
  });

  it('down reconstructs per-agent rows, recreates the agent-scoped index, and drops access', async () => {
    await migration.down(queryRunner);
    expect(
      queries.some(
        (q) =>
          q.includes('INSERT INTO "user_providers"') &&
          q.includes('ranked_grants.rn > 1') &&
          q.includes('ON CONFLICT ("id") DO NOTHING'),
      ),
    ).toBe(true);
    expect(queries.some((q) => q.includes('SET "agent_id" = first_grant."agent_id"'))).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX IF NOT EXISTS') &&
          q.includes('"IDX_user_providers_agent_provider_auth_label"') &&
          q.includes('"agent_id"'),
      ),
    ).toBe(true);
    expect(
      queries.some((q) =>
        q.includes('DROP CONSTRAINT IF EXISTS "FK_agent_provider_access_provider"'),
      ),
    ).toBe(true);
    expect(
      queries.some((q) => q.includes('DROP CONSTRAINT IF EXISTS "FK_agent_provider_access_agent"')),
    ).toBe(true);
    expect(queries.some((q) => q.includes('DROP TABLE IF EXISTS "agent_provider_access"'))).toBe(
      true,
    );
  });

  it('down aliases agent_provider_access as "apa" in the first_grant CTE (regression: a missing alias made the whole revert throw at plan time)', async () => {
    await migration.down(queryRunner);
    const firstGrant = queries.find((q) => q.includes('SET "agent_id" = first_grant."agent_id"'));
    expect(firstGrant).toBeDefined();
    expect(firstGrant).toContain('FROM "agent_provider_access" apa');
  });

  it('down is lossless: no blanket delete, and NOT NULL is restored only when every row is mapped', async () => {
    await migration.down(queryRunner);
    // The old blanket `DELETE FROM "user_providers" WHERE "agent_id" IS NULL`
    // dropped user-global providers (and their encrypted keys) on rollback — gone.
    expect(queries.some((q) => /DELETE\s+FROM\s+"user_providers"/i.test(q))).toBe(false);
    // NOT NULL is re-imposed only when no row is left unmapped, so an un-mappable
    // connection keeps its row instead of blocking the revert.
    expect(
      queries.some(
        (q) =>
          q.includes('IF NOT EXISTS (SELECT 1 FROM "user_providers" WHERE "agent_id" IS NULL)') &&
          q.includes('ALTER COLUMN "agent_id" SET NOT NULL'),
      ),
    ).toBe(true);
  });
});
