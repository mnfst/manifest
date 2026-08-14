import { AddAgentApiKeyPrefixActiveIndex1790000000000 } from './1790000000000-AddAgentApiKeyPrefixActiveIndex';

describe('AddAgentApiKeyPrefixActiveIndex1790000000000', () => {
  let migration: AddAgentApiKeyPrefixActiveIndex1790000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddAgentApiKeyPrefixActiveIndex1790000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up creates the composite (key_prefix, is_active) index', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_api_keys_prefix_active" ON "agent_api_keys" ("key_prefix", "is_active")`,
    );
  });

  it('down drops the index', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `DROP INDEX IF EXISTS "IDX_agent_api_keys_prefix_active"`,
    );
  });
});
