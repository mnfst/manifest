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
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "request_id"');
    expect(sql).toContain('NOT VALID');
    expect(sql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
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
});
