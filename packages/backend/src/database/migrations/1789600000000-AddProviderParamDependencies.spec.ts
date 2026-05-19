import { AddProviderParamDependencies1789600000000 } from './1789600000000-AddProviderParamDependencies';

describe('AddProviderParamDependencies1789600000000', () => {
  let migration: AddProviderParamDependencies1789600000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddProviderParamDependencies1789600000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('adds dependency metadata and marks Anthropic sampling params incompatible with thinking', async () => {
    await migration.up(queryRunner as never);
    const sql = queryRunner.query.mock.calls.map(([q]) => String(q)).join('\n');
    const params = queryRunner.query.mock.calls.map(([, p]) => p).filter(Boolean);

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "dependencies" jsonb');
    expect(sql).toContain("'anthropic-api-key-base-top-p'");
    expect(sql).toContain("'anthropic-api-key-base-top-k'");
    expect(params[0]).toEqual([
      JSON.stringify([
        {
          effect: 'disable',
          when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
        },
        {
          effect: 'omit',
          when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
        },
      ]),
    ]);
  });
});
