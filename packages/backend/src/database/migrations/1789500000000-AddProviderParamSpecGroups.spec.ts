import { AddProviderParamSpecGroups1789500000000 } from './1789500000000-AddProviderParamSpecGroups';

describe('AddProviderParamSpecGroups1789500000000', () => {
  let migration: AddProviderParamSpecGroups1789500000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddProviderParamSpecGroups1789500000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('adds grouping metadata and seeds Anthropic thinking controls', async () => {
    await migration.up(queryRunner as never);
    const sql = queryRunner.query.mock.calls.map(([q]) => String(q)).join('\n');
    const params = queryRunner.query.mock.calls.map(([, p]) => p).filter(Boolean);

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "group_key"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "depends_on_value" jsonb');
    expect(params).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          'anthropic-api-key-base-thinking-type',
          'anthropic',
          'api_key',
          null,
          'type',
          'thinking',
        ]),
        expect.arrayContaining([
          'anthropic-api-key-base-thinking-budget-tokens',
          'anthropic',
          'api_key',
          null,
          'budget_tokens',
          'thinking',
        ]),
      ]),
    );
  });
});
