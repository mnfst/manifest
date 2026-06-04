import { DropRedundantAgentApiKeyPrefixIndex1790400000000 } from './1790400000000-DropRedundantAgentApiKeyPrefixIndex';

describe('DropRedundantAgentApiKeyPrefixIndex1790400000000', () => {
  const migration = new DropRedundantAgentApiKeyPrefixIndex1790400000000();
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
    expect(migration.name).toBe('DropRedundantAgentApiKeyPrefixIndex1790400000000');
  });

  it('drops only the redundant agent_api_keys single-column index', async () => {
    await migration.up(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_api_keys_key_prefix"');
    // Must not touch the still-needed api_keys-table prefix index.
    expect(queries[0]).not.toContain('IDX_api_keys_key_prefix');
  });

  it('recreates the single-column index on rollback', async () => {
    await migration.down(mockQueryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('CREATE INDEX IF NOT EXISTS "IDX_agent_api_keys_key_prefix"');
    expect(queries[0]).toContain('ON "agent_api_keys" ("key_prefix")');
  });
});
