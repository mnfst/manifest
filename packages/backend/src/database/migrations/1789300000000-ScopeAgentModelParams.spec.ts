import { ScopeAgentModelParams1789300000000 } from './1789300000000-ScopeAgentModelParams';

describe('ScopeAgentModelParams1789300000000', () => {
  let migration: ScopeAgentModelParams1789300000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new ScopeAgentModelParams1789300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up adds scope_key and replaces the unique route index with a scoped identity', async () => {
    await migration.up(queryRunner as never);
    const sql = queryRunner.query.mock.calls.map(([q]) => String(q)).join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "scope_key"');
    expect(sql).toContain("'tier:' || tier AS scope_key");
    expect(sql).toContain("'specificity:' || category AS scope_key");
    expect(sql).toContain("'header:' || id AS scope_key");
    expect(sql).toContain('("agent_id", "scope_key", "provider", "model_name", "auth_type")');
  });

  it('down collapses scoped duplicates before restoring the old unique route index', async () => {
    await migration.down(queryRunner as never);
    const sql = queryRunner.query.mock.calls.map(([q]) => String(q)).join('\n');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('DROP COLUMN IF EXISTS "scope_key"');
    expect(sql).toContain('("agent_id", "provider", "auth_type", "model_name")');
  });
});
