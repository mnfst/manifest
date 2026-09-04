import { AddRequestsAutofixHealedIndex1802200000000 } from './1802200000000-AddRequestsAutofixHealedIndex';

describe('AddRequestsAutofixHealedIndex1802200000000', () => {
  const migration = new AddRequestsAutofixHealedIndex1802200000000();
  let queries: string[];

  const mockQueryRunner = {
    query: jest.fn().mockImplementation((sql: string) => {
      queries.push(sql);
      return Promise.resolve([]);
    }),
  } as never;

  beforeEach(() => {
    queries = [];
    jest.clearAllMocks();
  });

  it('exposes the expected migration name', () => {
    expect(migration.name).toBe('AddRequestsAutofixHealedIndex1802200000000');
  });

  it('runs outside a transaction so CONCURRENTLY is legal', () => {
    expect(migration.transaction).toBe(false);
  });

  it('clears an INVALID shell, builds the partial index, then refreshes stats', async () => {
    await migration.up(mockQueryRunner);

    expect(queries).toHaveLength(3);
    expect(queries[0]).toBe('DROP INDEX CONCURRENTLY IF EXISTS "IDX_requests_autofix_healed"');
    expect(queries[1]).toContain(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_requests_autofix_healed"',
    );
    expect(queries[1]).toContain('ON "requests" ("tenant_id", "timestamp")');
    expect(queries[1]).toContain('INCLUDE ("status")');
    expect(queries[1]).toContain(`WHERE "autofix_status" = 'retry_succeeded'`);
    expect(queries[2]).toBe('ANALYZE "requests"');
  });

  it('drops the index on rollback', async () => {
    await migration.down(mockQueryRunner);

    expect(queries).toEqual(['DROP INDEX CONCURRENTLY IF EXISTS "IDX_requests_autofix_healed"']);
  });
});
