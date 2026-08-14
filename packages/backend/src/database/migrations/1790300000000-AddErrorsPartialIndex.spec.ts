import { AddErrorsPartialIndex1790300000000 } from './1790300000000-AddErrorsPartialIndex';

describe('AddErrorsPartialIndex1790300000000', () => {
  const migration = new AddErrorsPartialIndex1790300000000();
  let queries: string[];

  const mockQueryRunner = {
    query: jest.fn().mockImplementation((sql: string) => {
      queries.push(sql);
      return Promise.resolve();
    }),
  } as never;

  beforeEach(() => {
    queries = [];
    jest.clearAllMocks();
  });

  it('exposes the expected migration name', () => {
    expect(migration.name).toBe('AddErrorsPartialIndex1790300000000');
  });

  it('creates a partial index scoped to error-status rows', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('CREATE INDEX IF NOT EXISTS "IDX_agent_messages_errors"');
    expect(queries[0]).toContain('ON "agent_messages" ("tenant_id", "timestamp")');
    expect(queries[0]).toContain(`WHERE "status" IN ('error', 'fallback_error', 'rate_limited')`);
  });

  it('drops the partial index on rollback', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_messages_errors"');
  });
});
