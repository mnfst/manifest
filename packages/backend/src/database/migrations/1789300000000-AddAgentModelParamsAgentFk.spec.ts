import { AddAgentModelParamsAgentFk1789300000000 } from './1789300000000-AddAgentModelParamsAgentFk';

describe('AddAgentModelParamsAgentFk1789300000000', () => {
  let migration: AddAgentModelParamsAgentFk1789300000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddAgentModelParamsAgentFk1789300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('purges orphans then adds the agent FK with ON DELETE CASCADE', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string);
    expect(sql[0]).toContain('DELETE FROM "agent_model_params"');
    expect(sql[0]).toContain('NOT IN (SELECT "id" FROM "agents")');
    expect(sql[1]).toContain('ADD CONSTRAINT "FK_agent_model_params_agent"');
    expect(sql[1]).toContain('REFERENCES "agents"("id")');
    expect(sql[1]).toContain('ON DELETE CASCADE');
  });

  it('drops the FK on down', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toContain('DROP CONSTRAINT "FK_agent_model_params_agent"');
  });
});
