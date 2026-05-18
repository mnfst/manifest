import { FlattenAgentModelParamsThinking1789200000000 } from './1789200000000-FlattenAgentModelParamsThinking';

describe('FlattenAgentModelParamsThinking1789200000000', () => {
  let migration: FlattenAgentModelParamsThinking1789200000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new FlattenAgentModelParamsThinking1789200000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up flattens legacy nested thinking storage into the UI value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');

    expect(sql).toContain('UPDATE agent_model_params');
    expect(sql).toContain("params = jsonb_set(params - 'thinking', '{thinking}'");
    expect(sql).toContain("params->'thinking'->'type'");
    expect(sql).toContain("jsonb_typeof(params->'thinking') = 'object'");
  });

  it('down restores the previous nested thinking shape', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');

    expect(sql).toContain('UPDATE agent_model_params');
    expect(sql).toContain("jsonb_build_object('type', params->'thinking')");
    expect(sql).toContain("jsonb_typeof(params->'thinking') = 'string'");
  });
});
