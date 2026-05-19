import { AddOpenAiProviderParamSpecs1789700000000 } from './1789700000000-AddOpenAiProviderParamSpecs';

describe('AddOpenAiProviderParamSpecs1789700000000', () => {
  let migration: AddOpenAiProviderParamSpecs1789700000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddOpenAiProviderParamSpecs1789700000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('seeds OpenAI API-key param specs with model-aware overrides', async () => {
    await migration.up(queryRunner as never);
    const sql = queryRunner.query.mock.calls.map(([q]) => String(q)).join('\n');
    const params = queryRunner.query.mock.calls.map(([, p]) => p).filter(Boolean);

    expect(sql).toContain('INSERT INTO "provider_param_specs"');
    expect(sql).toContain('"model_name"');
    expect(sql).toContain('"serializer" = NULL');
    expect(params).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          'openai-api-key-base-max-tokens',
          'openai',
          'api_key',
          null,
          'max_tokens',
          'number',
        ]),
        expect.arrayContaining([
          'openai-api-key-gpt-4o-temperature',
          'openai',
          'api_key',
          'gpt-4o',
          'temperature',
          'slider',
        ]),
        expect.arrayContaining([
          'openai-api-key-o3-reasoning-effort',
          'openai',
          'api_key',
          'o3',
          'reasoning_effort',
          'select',
        ]),
        expect.arrayContaining([
          'openai-api-key-gpt-5-1-reasoning-effort',
          'openai',
          'api_key',
          'gpt-5.1',
          'reasoning_effort',
          'select',
          'Reasoning effort',
          JSON.stringify('none'),
          JSON.stringify(['none', 'low', 'medium', 'high']),
        ]),
      ]),
    );
  });
});
