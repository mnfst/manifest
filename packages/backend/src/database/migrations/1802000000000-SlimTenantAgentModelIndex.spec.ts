import { SlimTenantAgentModelIndex1802000000000 } from './1802000000000-SlimTenantAgentModelIndex';

describe('SlimTenantAgentModelIndex1802000000000', () => {
  const migration = new SlimTenantAgentModelIndex1802000000000();
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
    expect(migration.name).toBe('SlimTenantAgentModelIndex1802000000000');
  });

  it('builds the slim agent+model index then drops the fat dedup index', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_tenant_agent_id_model"',
    );
    expect(queries[0]).toContain('ON "agent_messages"');
    expect(queries[0]).toContain('("tenant_id", "agent_id", "model")');
    expect(queries[1]).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_tenant_agent_model_status_ts"',
    );
  });

  it('restores the fat dedup index then drops the slim index on rollback', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_tenant_agent_model_status_ts"',
    );
    expect(queries[0]).toContain('("tenant_id", "agent_id", "model", "status", "timestamp")');
    expect(queries[1]).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_tenant_agent_id_model"',
    );
  });
});
