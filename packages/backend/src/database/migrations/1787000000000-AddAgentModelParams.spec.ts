import { AddAgentModelParams1787000000000 } from './1787000000000-AddAgentModelParams';

describe('AddAgentModelParams1787000000000', () => {
  let migration: AddAgentModelParams1787000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddAgentModelParams1787000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up creates the agent_model_params table with the unique route key and runs a non-destructive backfill', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');

    // 1. Table + unique route index. The unique index is the structural
    // guarantee that prevents same-(agent, provider, auth, model) writes from
    // racing each other.
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "agent_model_params"');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_model_params_route"');
    expect(sql).toContain('("agent_id", "provider", "auth_type", "model_name")');

    // 2. Backfill walks both source tables AND walks fallback_routes — not
    // just the primary. This is the Codex correction that prevents data loss
    // for tiers with an incompatible primary but a DeepSeek fallback.
    for (const sourceTable of ['tier_assignments', 'specificity_assignments']) {
      expect(sql).toContain(`FROM "${sourceTable}" t`);
    }
    expect(sql).toContain('jsonb_array_elements(s.fallback_routes)');
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain("WHERE LOWER(provider) IN ('deepseek')");
    expect(sql).toContain("param_defaults ? 'thinking'");
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('PARTITION BY agent_id, provider, auth_type, model_name');
    expect(sql).toContain('ORDER BY slot_priority DESC, source_id DESC');
    expect(sql).toContain('WHERE route_rank = 1');
    expect(sql).toContain('ON CONFLICT (agent_id, provider, auth_type, model_name)');

    // 3. This is the expand release: old deployments still serving during
    // Railway's healthcheck window must keep their legacy columns.
    expect(sql).not.toContain('DROP COLUMN IF EXISTS "param_defaults"');
  });

  it('down drops only the new table + indexes because the old columns are left in place', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');

    expect(sql).not.toContain('ADD COLUMN IF NOT EXISTS "param_defaults"');
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_agent_model_params_route"');
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_agent_model_params_agent"');
    expect(sql).toContain('DROP TABLE IF EXISTS "agent_model_params"');
  });
});
