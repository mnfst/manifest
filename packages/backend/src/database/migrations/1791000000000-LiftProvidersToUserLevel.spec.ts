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

  it('disambiguates colliding rows by relabeling on the index tuple, never on the encrypted key', async () => {
    await migration.up(queryRunner);

    const relabel = queries.find((q) => q.includes('ROW_NUMBER() OVER'));
    expect(relabel).toBeDefined();
    // Regression guard: keys are encrypted with a random IV, so the same key
    // yields different ciphertext per row. Partitioning on api_key_encrypted
    // would miss real collisions and the unique index in step 6 would fail on
    // boot. The relabel MUST partition on (user_id, provider, auth_type,
    // LOWER(label)) — the exact tuple the new index keys on.
    expect(relabel).toContain('PARTITION BY "user_id", "provider", "auth_type", LOWER("label")');
    expect(relabel).not.toContain('"api_key_encrypted"');
  });

  it('NEVER deletes a provider row (relabels instead, so no key is lost)', async () => {
    await migration.up(queryRunner);
    // The whole point of relabeling: two agents with different keys under the
    // same label must both survive. A DELETE on user_providers would silently
    // drop a real key, which is the data-loss bug this approach avoids.
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
