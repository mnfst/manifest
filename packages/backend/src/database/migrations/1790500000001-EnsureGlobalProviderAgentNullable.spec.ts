import { EnsureGlobalProviderAgentNullable1790500000001 } from './1790500000001-EnsureGlobalProviderAgentNullable';

describe('EnsureGlobalProviderAgentNullable1790500000001', () => {
  const makeRunner = () => {
    const queries: string[] = [];
    return {
      queries,
      runner: {
        query: jest.fn((sql: string) => {
          queries.push(sql);
          return Promise.resolve();
        }),
      },
    };
  };

  it('drops the stale not-null constraint for already-migrated databases', async () => {
    const migration = new EnsureGlobalProviderAgentNullable1790500000001();
    const { queries, runner } = makeRunner();

    await migration.up(runner as any);

    expect(queries).toEqual([`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" DROP NOT NULL`]);
  });

  it('removes global rows before restoring the agent-only constraint', async () => {
    const migration = new EnsureGlobalProviderAgentNullable1790500000001();
    const { queries, runner } = makeRunner();

    await migration.down(runner as any);

    expect(queries).toEqual([
      `DELETE FROM "user_providers" WHERE "agent_id" IS NULL`,
      `ALTER TABLE "user_providers" ALTER COLUMN "agent_id" SET NOT NULL`,
    ]);
  });
});
