import { WidenKeyHashColumn1774000000000 } from './1774000000000-WidenKeyHashColumn';

describe('WidenKeyHashColumn1774000000000', () => {
  const migration = new WidenKeyHashColumn1774000000000();
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

  it('widens key_hash columns to varchar(128)', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('agent_api_keys');
    expect(queries[0]).toContain('varchar(128)');
    expect(queries[1]).toContain('api_keys');
    expect(queries[1]).toContain('varchar(128)');
  });

  it('reverts key_hash columns to varchar(64) with truncation', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('agent_api_keys');
    expect(queries[0]).toContain('varchar(64)');
    expect(queries[0]).toContain('USING left');
    expect(queries[1]).toContain('api_keys');
    expect(queries[1]).toContain('varchar(64)');
    expect(queries[1]).toContain('USING left');
  });
});
