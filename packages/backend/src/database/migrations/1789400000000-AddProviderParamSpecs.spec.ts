import { AddProviderParamSpecs1789400000000 } from './1789400000000-AddProviderParamSpecs';

describe('AddProviderParamSpecs1789400000000', () => {
  let migration: AddProviderParamSpecs1789400000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddProviderParamSpecs1789400000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('creates the provider_param_specs table and seeds current built-in specs', async () => {
    await migration.up(queryRunner as never);
    const sql = queryRunner.query.mock.calls.map(([q]) => String(q)).join('\n');
    const params = queryRunner.query.mock.calls.map(([, p]) => p).filter(Boolean);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "provider_param_specs"');
    expect(sql).toContain('"control_kind" varchar NOT NULL');
    expect(sql).toContain('"default_value" jsonb NOT NULL');
    expect(sql).toContain('"serializer" varchar DEFAULT NULL');
    expect(params).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['anthropic-api-key-base-max-tokens', 'anthropic', 'api_key']),
        expect.arrayContaining(['deepseek-api-key-base-thinking', 'deepseek', 'api_key']),
      ]),
    );
  });
});
