import { AddKeyPrefixIndex1773900000000 } from './1773900000000-AddKeyPrefixIndex';

describe('AddKeyPrefixIndex1773900000000', () => {
  const migration = new AddKeyPrefixIndex1773900000000();
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

  it('creates indexes on key_prefix columns', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('IDX_agent_api_keys_key_prefix');
    expect(queries[1]).toContain('IDX_api_keys_key_prefix');
  });

  it('drops indexes on rollback', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('DROP INDEX');
    expect(queries[1]).toContain('DROP INDEX');
  });
});
