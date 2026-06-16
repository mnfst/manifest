import { AddProviderUsageCoveringIndex1792900000000 } from './1792900000000-AddProviderUsageCoveringIndex';

/**
 * Build a QueryRunner mock whose `query` answers the two probe SELECTs
 * (index-exists, reltuples estimate) and records any subsequent CREATE/DROP.
 */
function makeRunner(opts: { indexExists?: boolean; estimate?: number }) {
  const ddl: string[] = [];
  const query = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('FROM pg_class') && sql.includes("relkind = 'i'")) {
      return Promise.resolve(opts.indexExists ? [{ '?column?': 1 }] : []);
    }
    if (sql.includes('reltuples')) {
      return Promise.resolve(opts.estimate === undefined ? [] : [{ estimate: opts.estimate }]);
    }
    ddl.push(sql);
    return Promise.resolve();
  });
  return { runner: { query } as never, ddl };
}

describe('AddProviderUsageCoveringIndex1792900000000', () => {
  const migration = new AddProviderUsageCoveringIndex1792900000000();

  afterEach(() => jest.restoreAllMocks());

  it('exposes the expected migration name', () => {
    expect(migration.name).toBe('AddProviderUsageCoveringIndex1792900000000');
  });

  it('creates the covering INCLUDE index inline on a small table', async () => {
    const { runner, ddl } = makeRunner({ estimate: 1000 });

    await migration.up(runner);

    expect(ddl).toHaveLength(1);
    expect(ddl[0]).toContain('CREATE INDEX IF NOT EXISTS "IDX_agent_messages_provider_usage"');
    expect(ddl[0]).toContain('ON "agent_messages" ("tenant_id", "timestamp")');
    expect(ddl[0]).toContain(
      'INCLUDE ("provider", "auth_type", "input_tokens", "output_tokens", "cost_usd")',
    );
  });

  it('creates the index when the table has no row estimate yet (fresh table)', async () => {
    const { runner, ddl } = makeRunner({ estimate: undefined });

    await migration.up(runner);

    expect(ddl).toHaveLength(1);
    expect(ddl[0]).toContain('CREATE INDEX IF NOT EXISTS "IDX_agent_messages_provider_usage"');
  });

  it('skips the inline build and warns on a large table', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { runner, ddl } = makeRunner({ estimate: 5_000_000 });

    await migration.up(runner);

    expect(ddl).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipping inline'));
  });

  it('is a no-op when the index already exists (created out-of-band)', async () => {
    const { runner, ddl } = makeRunner({ indexExists: true, estimate: 5_000_000 });

    await migration.up(runner);

    expect(ddl).toHaveLength(0);
  });

  it('drops the index on rollback', async () => {
    const { runner, ddl } = makeRunner({ estimate: 0 });

    await migration.down(runner);

    expect(ddl).toHaveLength(1);
    expect(ddl[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_messages_provider_usage"');
  });
});
