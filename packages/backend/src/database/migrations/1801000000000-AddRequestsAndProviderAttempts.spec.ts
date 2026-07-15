import { AddRequestsAndProviderAttempts1801000000000 } from './1801000000000-AddRequestsAndProviderAttempts';

describe('AddRequestsAndProviderAttempts1801000000000', () => {
  const migration = new AddRequestsAndProviderAttempts1801000000000();
  let queries: string[];
  const runner = {
    query: jest.fn().mockImplementation((sql: string) => {
      queries.push(sql);
      return Promise.resolve();
    }),
  } as never;

  beforeEach(() => {
    queries = [];
    jest.clearAllMocks();
  });

  it('keeps historical data work out of the deploy migration', async () => {
    await migration.up(runner);

    const sql = queries.join('\n');
    expect(migration.transaction).toBe(false);
    expect(queries[0]).toContain("SET lock_timeout = '5s'");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "requests"');
    expect(sql).toContain('ALTER TABLE "agent_messages" RENAME TO "provider_attempts"');
    expect(sql).toContain('CREATE VIEW "agent_messages" AS SELECT * FROM "provider_attempts"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "request_id"');
    expect(sql).toContain('NOT VALID');
    expect(sql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
    expect(sql).toContain(
      '"IDX_provider_attempts_request_id" ON "provider_attempts" ("request_id", "id")',
    );
    expect(sql).toContain('"IDX_provider_attempts_unlinked_fallback"');
    expect(sql).not.toMatch(/INSERT\s+INTO\s+"requests"/i);
    expect(sql).not.toMatch(/UPDATE\s+"provider_attempts"/i);
  });

  it('is restart-safe after a partially completed non-transactional run', async () => {
    await migration.up(runner);
    const sql = queries.join('\n');
    expect(sql).toContain('IF NOT EXISTS "request_id"');
    expect(sql).toContain('IF NOT EXISTS (');
    expect(sql).toContain('IF NOT EXISTS "IDX_provider_attempts_request_id"');
  });

  it('renames the table and creates its compatibility view atomically', async () => {
    await migration.up(runner);

    const cutover = queries.find(
      (sql) => sql.includes('RENAME TO "provider_attempts"') && sql.includes('CREATE VIEW'),
    );
    expect(cutover).toContain('CREATE VIEW "agent_messages" AS SELECT * FROM "provider_attempts"');

    const cutoverIndex = queries.indexOf(cutover!);
    const requestIdIndex = queries.findIndex((sql) => sql.includes('ADD COLUMN IF NOT EXISTS'));
    expect(cutoverIndex).toBeLessThan(requestIdIndex);
  });

  it('drops an invalid concurrent index before rebuilding it', async () => {
    (runner as { query: jest.Mock }).query.mockImplementation((sql: string) => {
      queries.push(sql);
      return Promise.resolve(sql.includes('i.indisvalid') ? [{ valid: false }] : undefined);
    });

    await migration.up(runner);

    const drop = queries.findIndex((sql) => sql.includes('DROP INDEX CONCURRENTLY'));
    const create = queries.findIndex((sql) => sql.includes('CREATE INDEX CONCURRENTLY'));
    expect(drop).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(drop);
  });

  it('checks index validity on provider_attempts rather than by global name alone', async () => {
    await migration.up(runner);

    const validityQuery = queries.find((sql) => sql.includes('i.indisvalid'));
    expect(validityQuery).toContain("i.indrelid = 'provider_attempts'::regclass");
  });

  it('rebuilds a valid fallback index whose key order cannot support the bounded lookup', async () => {
    (runner as { query: jest.Mock }).query.mockImplementation((sql: string) => {
      queries.push(sql);
      if (sql.includes("c.relname = 'IDX_provider_attempts_request_id'")) {
        return Promise.resolve([{ valid: true, definition: '(request_id, id)' }]);
      }
      if (sql.includes("c.relname = 'IDX_provider_attempts_unlinked_fallback'")) {
        return Promise.resolve([
          {
            valid: true,
            definition: '(tenant_id, agent_id, fallback_from_model, "timestamp")',
          },
        ]);
      }
      return Promise.resolve();
    });

    await migration.up(runner);

    expect(
      queries.some((sql) =>
        sql.includes('DROP INDEX CONCURRENTLY IF EXISTS "IDX_provider_attempts_unlinked_fallback"'),
      ),
    ).toBe(true);
  });

  it('drops the compatibility view before restoring the old table name', async () => {
    await migration.down(runner);

    const rollback = queries.find(
      (sql) =>
        sql.includes('DROP VIEW "agent_messages"') && sql.includes('RENAME TO "agent_messages"'),
    );
    expect(rollback).toBeDefined();
    expect(rollback!.indexOf('DROP VIEW "agent_messages"')).toBeLessThan(
      rollback!.indexOf('RENAME TO "agent_messages"'),
    );
  });
});
