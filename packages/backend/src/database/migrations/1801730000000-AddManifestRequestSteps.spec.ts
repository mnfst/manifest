import { AddManifestRequestSteps1801730000000 } from './1801730000000-AddManifestRequestSteps';

describe('AddManifestRequestSteps1801730000000', () => {
  const migration = new AddManifestRequestSteps1801730000000();
  const query = jest.fn().mockResolvedValue([]);

  beforeEach(() => jest.clearAllMocks());

  it('adds a non-null empty manifest_steps array under a bounded lock wait', async () => {
    await migration.up({ query, isTransactionActive: true } as never);

    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toContain("SET LOCAL lock_timeout = '5s'");
    expect(statements.join(' ')).toContain(
      `ADD COLUMN IF NOT EXISTS "manifest_steps" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  });

  it('drops the column and resets a session lock timeout', async () => {
    await migration.down({ query, isTransactionActive: false } as never);

    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toContain("SET lock_timeout = '5s'");
    expect(statements.join(' ')).toContain('DROP COLUMN IF EXISTS "manifest_steps"');
    expect(statements.at(-1)).toContain('RESET lock_timeout');
  });
});
