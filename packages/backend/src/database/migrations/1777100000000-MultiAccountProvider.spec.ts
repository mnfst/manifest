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

      // Should have: drop override_provider_id (2x), drop indexes (2x),
      // reconcile duplicates, recreate unique index, drop columns (2x)
      expect(queryRunner.query).toHaveBeenCalledTimes(8);
      // Verify columns are dropped
      const allSql = queries.join('\n');
      expect(allSql).toContain('DROP COLUMN "is_default"');
      expect(allSql).toContain('DROP COLUMN "account_label"');
      // Verify the final unique index recreation
      expect(allSql).toContain('CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth"');
    });

    it('should DELETE duplicate rows across ALL rows, not just active', async () => {
      const queries: string[] = [];
      const queryRunner = {
        query: jest.fn((sql: string) => {
          queries.push(sql);
          return Promise.resolve();
        }),
      } as any;

      await migration.down(queryRunner);

      const reconcileQuery = queries.find(
        (q) => q.includes('ROW_NUMBER()') && q.includes('DELETE FROM'),
      );
      expect(reconcileQuery).toBeDefined();

      // Must NOT filter to is_active = true only (that was the bug)
      expect(reconcileQuery!).not.toMatch(
        /FROM\s+"user_providers"\s+WHERE\s+"is_active"\s*=\s*true\s*\)/,
      );

      // Must be a DELETE, not an UPDATE that just deactivates
      expect(reconcileQuery!).toContain('DELETE FROM "user_providers"');
      expect(reconcileQuery!).not.toContain('SET "is_active" = false');

      // Must rank across all rows (no WHERE filter on the source)
      expect(reconcileQuery!).toMatch(/FROM\s+"user_providers"\s*\)/);

      // Must prefer default and active rows as survivors
      expect(reconcileQuery!).toContain('"is_default" DESC');
      expect(reconcileQuery!).toContain('"is_active" DESC');
    });

    it('should rank rows deterministically: default → active → earliest connected → lowest id', async () => {
      const queries: string[] = [];
      const queryRunner = {
        query: jest.fn((sql: string) => {
          queries.push(sql);
          return Promise.resolve();
        }),
      } as any;

      await migration.down(queryRunner);

      const reconcileQuery = queries.find((q) => q.includes('ROW_NUMBER()'));
      expect(reconcileQuery).toBeDefined();

      // Verify the ORDER BY clause is correct
      expect(reconcileQuery!).toContain(
        'ORDER BY "is_default" DESC, "is_active" DESC, "connected_at" ASC, "id" ASC',
      );
    });
  });
});
