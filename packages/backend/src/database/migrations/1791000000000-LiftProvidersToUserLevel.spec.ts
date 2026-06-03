import { LiftProvidersToUserLevel1791000000000 } from './1791000000000-LiftProvidersToUserLevel';

describe('LiftProvidersToUserLevel1791000000000', () => {
  const migration = new LiftProvidersToUserLevel1791000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('up creates the junction table, lifts providers to user level, and swaps the unique index', async () => {
    await migration.up(queryRunner);

    expect(queries.some((q) => q.includes('CREATE TABLE "agent_provider_access"'))).toBe(true);
    expect(queries.some((q) => q.includes('ALTER COLUMN "agent_id" DROP NOT NULL'))).toBe(true);
    // Backfill access from the existing agent-scoped rows.
    expect(
      queries.some(
        (q) =>
          q.includes('INSERT INTO "agent_provider_access"') && q.includes('FROM "user_providers"'),
      ),
    ).toBe(true);
    // New user-scoped unique index keyed on LOWER(label).
    expect(
      queries.some(
        (q) =>
          q.includes('CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"') &&
          q.includes('LOWER("label")'),
      ),
    ).toBe(true);
    // Old agent-scoped index dropped.
    expect(
      queries.some((q) =>
        q.includes('DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth_label"'),
      ),
    ).toBe(true);
    // Providers become user-scoped.
    expect(queries.some((q) => q.includes('UPDATE "user_providers" SET "agent_id" = NULL'))).toBe(
      true,
    );
  });

  it('dedups on the SAME tuple the unique index enforces, not on the encrypted key', async () => {
    await migration.up(queryRunner);

    const dedup = queries.find((q) => q.includes('HAVING COUNT(*) > 1'));
    expect(dedup).toBeDefined();
    // Regression guard: keys are encrypted with a random IV, so the same key
    // yields different ciphertext per row. Grouping on api_key_encrypted would
    // never collapse those duplicates and the unique index in step 6 would then
    // fail on boot. The dedup MUST group on (user_id, provider, auth_type,
    // LOWER(label)) — the exact tuple the new index keys on.
    expect(dedup).toContain('GROUP BY "user_id", "provider", "auth_type", LOWER("label")');
    expect(dedup).not.toContain('"api_key_encrypted"');
  });

  it('runs the dedup BEFORE creating the unique index', async () => {
    await migration.up(queryRunner);

    const dedupIdx = queries.findIndex((q) => q.includes('HAVING COUNT(*) > 1'));
    const createIdx = queries.findIndex((q) =>
      q.includes('CREATE UNIQUE INDEX "IDX_user_providers_user_provider_auth_label"'),
    );
    expect(dedupIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(dedupIdx);
  });

  it('down restores the agent-scoped schema', async () => {
    await migration.down(queryRunner);

    expect(
      queries.some((q) =>
        q.includes('DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"'),
      ),
    ).toBe(true);
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
