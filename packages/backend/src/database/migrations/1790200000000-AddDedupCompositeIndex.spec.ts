import { AddDedupCompositeIndex1790200000000 } from './1790200000000-AddDedupCompositeIndex';

describe('AddDedupCompositeIndex1790200000000', () => {
  const migration = new AddDedupCompositeIndex1790200000000();
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
    expect(migration.name).toBe('AddDedupCompositeIndex1790200000000');
  });

  it('creates the composite dedup index on the dedup filter + order columns', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain(
      'CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_agent_model_status_ts"',
    );
    expect(queries[0]).toContain('ON "agent_messages"');
    expect(queries[0]).toContain('("tenant_id", "agent_id", "model", "status", "timestamp")');
  });

  it('drops the composite dedup index on rollback', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain(
      'DROP INDEX IF EXISTS "IDX_agent_messages_tenant_agent_model_status_ts"',
    );
  });
});
