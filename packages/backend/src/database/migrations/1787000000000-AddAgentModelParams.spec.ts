import { AddAgentModelParams1787000000000 } from './1787000000000-AddAgentModelParams';

describe('AddAgentModelParams1787000000000', () => {
  let migration: AddAgentModelParams1787000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddAgentModelParams1787000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up creates the agent_model_params table with the unique route key, runs the backfill, and drops the old param_defaults columns', async () => {
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
    expect(sql).toContain('ON CONFLICT (agent_id, provider, auth_type, model_name)');

    // 3. Drops the old columns from both source tables.
    expect(sql).toContain('ALTER TABLE "tier_assignments" DROP COLUMN IF EXISTS "param_defaults"');
    expect(sql).toContain(
      'ALTER TABLE "specificity_assignments" DROP COLUMN IF EXISTS "param_defaults"',
    );
  });

  it('down restores the old columns and drops the new table + indexes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');

    // Old columns reappear (empty — backfill from agent_model_params is not
    // worth the complexity since on re-up the table is rebuilt anyway).
    expect(sql).toContain(
      'ALTER TABLE "tier_assignments" ADD COLUMN IF NOT EXISTS "param_defaults" jsonb',
    );
    expect(sql).toContain(
      'ALTER TABLE "specificity_assignments" ADD COLUMN IF NOT EXISTS "param_defaults" jsonb',
    );

    expect(sql).toContain('DROP INDEX IF EXISTS "idx_agent_model_params_route"');
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_agent_model_params_agent"');
    expect(sql).toContain('DROP TABLE IF EXISTS "agent_model_params"');
  });
});
