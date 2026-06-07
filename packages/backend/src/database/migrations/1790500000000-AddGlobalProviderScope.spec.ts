import { AddGlobalProviderScope1790500000000 } from './1790500000000-AddGlobalProviderScope';

describe('AddGlobalProviderScope1790500000000', () => {
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

  it('makes agent_id nullable and creates scoped unique indexes', async () => {
    const migration = new AddGlobalProviderScope1790500000000();
    const { queries, runner } = makeRunner();

    await migration.up(runner as any);

    expect(queries.join('\n')).toContain('ALTER COLUMN "agent_id" DROP NOT NULL');
    expect(queries.join('\n')).toContain('WHERE "agent_id" IS NOT NULL');
    expect(queries.join('\n')).toContain('IDX_user_providers_global_provider_auth_label');
    expect(queries.join('\n')).toContain('WHERE "agent_id" IS NULL');
  });

  it('drops global rows before restoring the not-null agent scope', async () => {
    const migration = new AddGlobalProviderScope1790500000000();
    const { queries, runner } = makeRunner();

    await migration.down(runner as any);

    expect(queries[0]).toContain('DELETE FROM "user_providers" WHERE "agent_id" IS NULL');
    expect(queries.join('\n')).toContain('ALTER COLUMN "agent_id" SET NOT NULL');
  });
});
