import { AddTenantRequestUsage1801300000000 } from './1801300000000-AddTenantRequestUsage';

describe('AddTenantRequestUsage1801300000000', () => {
  let statements: Array<{ sql: string; params?: unknown[] }>;
  const queryRunner = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
    }),
  };

  beforeEach(() => {
    statements = [];
    jest.clearAllMocks();
  });

  it('adds an exact counter, idempotency markers, trigger, and race-safe seeds', async () => {
    const migration = new AddTenantRequestUsage1801300000000();
    await migration.up(queryRunner as never);

    const sql = statements.map((statement) => statement.sql).join('\n');
    expect(migration.transaction).toBe(false);
    expect(statements[0].sql).toContain("SET lock_timeout = '5s'");
    expect(statements.at(-1)?.sql).toContain('RESET lock_timeout');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "tenant_request_usage"');
    expect(sql).toContain('PRIMARY KEY ("tenant_id", "window_start")');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "quota_counted" boolean');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "quota_window_start" timestamp');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "legacy_quota_counted" boolean');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION "count_tenant_request_usage"()');
    expect(sql).toContain('AFTER INSERT OR UPDATE OF "request_id" ON "agent_messages"');
    expect(sql).toContain('AND r."quota_counted" = false');
    expect(sql).toContain('OLD.legacy_quota_counted');
    expect(sql).toContain('COALESCE(m."superseded", false) = false');
    expect(sql).toContain("m.\"error_origin\" NOT IN ('config', 'policy', 'internal', 'request')");
    expect(sql).toContain('"tenant_request_usage"."request_count" + EXCLUDED."request_count"');

    const seedParams = statements
      .filter((statement) => statement.params)
      .map((statement) => statement.params);
    expect(seedParams).toHaveLength(2);
    expect(seedParams[0]).toEqual(seedParams[1]);
  });

  it('resets the lock timeout after a failed migration statement', async () => {
    const failure = new Error('lock timeout');
    queryRunner.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
      if (sql.includes('CREATE TABLE')) throw failure;
    });

    await expect(new AddTenantRequestUsage1801300000000().up(queryRunner as never)).rejects.toBe(
      failure,
    );
    expect(statements.at(-1)?.sql).toContain('RESET lock_timeout');
  });

  it('removes the trigger before its supporting columns and table', async () => {
    await new AddTenantRequestUsage1801300000000().down(queryRunner as never);

    const sql = statements.map((statement) => statement.sql).join('\n');
    expect(sql.indexOf('DROP TRIGGER')).toBeLessThan(sql.indexOf('DROP FUNCTION'));
    expect(sql).toContain('DROP COLUMN IF EXISTS "legacy_quota_counted"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "quota_window_start"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "quota_counted"');
    expect(sql).toContain('DROP TABLE IF EXISTS "tenant_request_usage"');
    expect(statements.at(-1)?.sql).toContain('RESET lock_timeout');
  });
});
