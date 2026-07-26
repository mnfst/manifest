import { AddErrorFamilyTimestampIndex1801300000000 } from './1801300000000-AddErrorFamilyTimestampIndex';

describe('AddErrorFamilyTimestampIndex1801300000000', () => {
  const migration = new AddErrorFamilyTimestampIndex1801300000000();
  let queries: string[];

  const mockQueryRunner = {
    query: jest.fn().mockImplementation((sql: string) => {
      queries.push(sql);
      return Promise.resolve([]);
    }),
  } as never;

  beforeEach(() => {
    queries = [];
    jest.clearAllMocks();
  });

  it('exposes the expected migration name', () => {
    expect(migration.name).toBe('AddErrorFamilyTimestampIndex1801300000000');
  });

  it('runs outside a transaction so the builds can be CONCURRENT', () => {
    expect(migration.transaction).toBe(false);
  });

  it('builds the five-status index before dropping the legacy trio index', async () => {
    await migration.up(mockQueryRunner);

    const create = queries.find((sql) =>
      sql.startsWith(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_error_family_timestamp"',
      ),
    );
    expect(create).toBeDefined();
    expect(create).toContain('ON "agent_messages" ("timestamp")');
    expect(create).toContain(
      `WHERE "status" IN ('error', 'fallback_error', 'rate_limited', 'auto_fixed', 'failed')`,
    );

    // Swap order: build the wider index, then drop the trio one — every trio
    // query implies the wider predicate, so scans stay index-served throughout.
    const createAt = queries.indexOf(create as string);
    const dropLegacyAt = queries.findIndex((sql) =>
      sql.includes('DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_errors_timestamp"'),
    );
    expect(dropLegacyAt).toBeGreaterThan(createAt);
  });

  it('clears an invalid leftover before creating (interrupted CONCURRENTLY build)', async () => {
    await migration.up(mockQueryRunner);

    expect(queries[0]).toBe(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_error_family_timestamp"',
    );
  });

  it('down drops the family index and restores the legacy trio index', async () => {
    await migration.down(mockQueryRunner);

    expect(queries[0]).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_error_family_timestamp"',
    );
    const recreate = queries.find((sql) =>
      sql.startsWith(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_errors_timestamp"',
      ),
    );
    expect(recreate).toContain(`WHERE "status" IN ('error', 'fallback_error', 'rate_limited')`);
  });
});
