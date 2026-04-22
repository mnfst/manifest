import { MultiAccountProvider1777100000000 } from './1777100000000-MultiAccountProvider';

describe('MultiAccountProvider1777100000000', () => {
  let migration: MultiAccountProvider1777100000000;

  beforeEach(() => {
    migration = new MultiAccountProvider1777100000000();
  });

  it('should have a name property matching the class name + timestamp', () => {
    expect(migration.name).toBe('MultiAccountProvider1777100000000');
  });

  it('should expose up and down methods', () => {
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  describe('down', () => {
    it('should call queryRunner.query for each step including reconciliation', async () => {
      const queries: string[] = [];
      const queryRunner = {
        query: jest.fn((sql: string) => {
          queries.push(sql);
          return Promise.resolve();
        }),
      } as any;

      await migration.down(queryRunner);

      // Should have: drop override_provider_id (2x), drop indexes,
      // reconcile duplicates, recreate unique index, drop columns (2x)
      expect(queryRunner.query).toHaveBeenCalled();
      const allSql = queries.join('\n');
      // Verify the reconciliation UPDATE is present
      expect(allSql).toContain('UPDATE "user_providers"');
      expect(allSql).toContain('is_active');
      // Verify the final unique index recreation
      expect(allSql).toContain('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth"');
      // Verify columns are dropped
      expect(allSql).toContain('DROP COLUMN "is_default"');
      expect(allSql).toContain('DROP COLUMN "account_label"');
    });
  });
});
