import { WidenApiKeyColumn1774896789000 } from './1774896789000-WidenApiKeyColumn';

describe('WidenApiKeyColumn1774896789000', () => {
  const migration = new WidenApiKeyColumn1774896789000();
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

  it('has the correct migration name', () => {
    expect(migration.name).toBe('WidenApiKeyColumn1774896789000');
  });

  it('widens key column to varchar(255)', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('agent_api_keys');
    expect(queries[0]).toContain('character varying(255)');
  });

  it('reverts key column to varchar(64) with USING truncation', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('agent_api_keys');
    expect(queries[0]).toContain('character varying(64)');
    expect(queries[0]).toContain('USING left');
  });
});
