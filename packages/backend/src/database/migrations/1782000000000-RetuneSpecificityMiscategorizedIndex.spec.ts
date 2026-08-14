import { RetuneSpecificityMiscategorizedIndex1782000000000 } from './1782000000000-RetuneSpecificityMiscategorizedIndex';

describe('RetuneSpecificityMiscategorizedIndex1782000000000', () => {
  const migration = new RetuneSpecificityMiscategorizedIndex1782000000000();
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

  it('drops the old index and recreates it keyed by agent_id', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_messages_miscategorized"');
    expect(queries[1]).toContain('CREATE INDEX IF NOT EXISTS "IDX_agent_messages_miscategorized"');
    expect(queries[1]).toContain('"agent_id", "specificity_category"');
    expect(queries[1]).toContain(`WHERE "specificity_miscategorized" = true`);
    expect(queries[1]).not.toMatch(/"tenant_id"\s*,\s*"agent_id"/);
  });

  it('rollback restores the original (tenant_id, agent_id, ...) index', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_messages_miscategorized"');
    expect(queries[1]).toContain('CREATE INDEX IF NOT EXISTS "IDX_agent_messages_miscategorized"');
    expect(queries[1]).toContain('"tenant_id", "agent_id", "specificity_category"');
    expect(queries[1]).toContain(`WHERE "specificity_miscategorized" = true`);
  });
});
