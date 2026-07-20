import { AddProviderAttemptOrdering1801100000000 } from './1801100000000-AddProviderAttemptOrdering';

describe('AddProviderAttemptOrdering1801100000000', () => {
  it('adds restart-safe ordering constraints without rewriting existing rows', async () => {
    const statements: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes('pg_get_indexdef')) return [];
        return undefined;
      }),
    };

    await new AddProviderAttemptOrdering1801100000000().up(queryRunner as never);

    const sql = statements.join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "attempt_number" integer');
    expect(sql).toContain('CHECK ("attempt_number" IS NULL OR "attempt_number" > 0) NOT VALID');
    expect(sql).toContain('CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS');
    expect(sql).toContain('("request_id", "attempt_number")');
    expect(sql).not.toMatch(/UPDATE\s+"agent_messages"/i);
  });
});
