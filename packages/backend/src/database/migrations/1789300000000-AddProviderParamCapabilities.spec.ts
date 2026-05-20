import type { QueryRunner } from 'typeorm';

import { AddProviderParamCapabilities1789300000000 } from './1789300000000-AddProviderParamCapabilities';

describe('AddProviderParamCapabilities1789300000000', () => {
  let migration: AddProviderParamCapabilities1789300000000;
  let queryRunner: { query: jest.Mock<Promise<unknown>, [string, unknown[]?]> };

  beforeEach(() => {
    migration = new AddProviderParamCapabilities1789300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up creates the provider param specs table and lookup indexes', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    const sql = queryRunner.query.mock.calls.map((c) => c[0]).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "provider_param_specs"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "idx_provider_param_specs_route_path"',
    );
    expect(sql).toContain('("provider", "auth_type", "model_name", "param_path")');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_provider_param_specs_lookup"');
  });

  it('seeds OpenAI subscription models with Responses-native params only', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(
      jsonColumn(row('openai', 'subscription', 'gpt-5.3-codex', 'reasoning.effort'), 8),
    ).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh']);
    expect(jsonColumn(row('openai', 'subscription', 'gpt-5.5', 'reasoning.effort'), 8)).toEqual([
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
    ]);
    expect(
      jsonColumn(row('openai', 'subscription', 'gpt-5.4-mini', 'reasoning.effort'), 8),
    ).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh']);
    expect(
      jsonColumn(row('openai', 'subscription', 'gpt-5.3-codex-spark', 'reasoning.effort'), 8),
    ).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh']);
    expect(
      jsonColumn(row('openai', 'subscription', 'gpt-5.1-codex-max', 'reasoning.effort'), 8),
    ).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh']);
    expect(
      jsonColumn(row('openai', 'subscription', 'gpt-5.1-codex', 'reasoning.effort'), 8),
    ).toEqual(['minimal', 'low', 'medium', 'high']);
    expect(
      jsonColumn(row('openai', 'subscription', 'gpt-5.3-codex', 'reasoning.summary'), 8),
    ).toEqual(['auto', 'concise', 'detailed', 'none']);
    expect(jsonColumn(row('openai', 'subscription', 'gpt-5.3-codex', 'text.verbosity'), 8)).toEqual(
      ['low', 'medium', 'high'],
    );
    expect(row('openai', 'subscription', 'gpt-5.3-codex', 'temperature')).toBeUndefined();
    expect(row('openai', 'subscription', 'gpt-5.3-codex', 'top_p')).toBeUndefined();
    expect(row('openai', 'subscription', 'gpt-5.3-codex', 'max_tokens')).toBeUndefined();
  });

  it('seeds Anthropic subscription models with their model-specific thinking rules', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(
      jsonColumn(row('anthropic', 'subscription', 'claude-sonnet-4', 'thinking.type'), 8),
    ).toEqual(['disabled', 'adaptive', 'enabled']);
    expect(
      jsonColumn(row('anthropic', 'subscription', 'claude-haiku-4', 'thinking.type'), 8),
    ).toEqual(['disabled', 'enabled']);
    expect(
      jsonColumn(row('anthropic', 'subscription', 'claude-sonnet-4', 'temperature'), 11),
    ).toEqual({ except: { 'thinking.type': ['adaptive', 'enabled'] } });
    expect(
      row('anthropic', 'subscription', 'claude-sonnet-4', 'thinking.budget_tokens'),
    ).toBeDefined();
  });

  it('down drops the provider param specs table and indexes', async () => {
    await migration.down(queryRunner as unknown as QueryRunner);

    const sql = queryRunner.query.mock.calls.map((c) => c[0]).join('\n');
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_provider_param_specs_lookup"');
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_provider_param_specs_route_path"');
    expect(sql).toContain('DROP TABLE IF EXISTS "provider_param_specs"');
  });

  function row(
    provider: string,
    authType: string,
    model: string,
    path: string,
  ): unknown[] | undefined {
    return insertedRows().find(
      (args) =>
        args[1] === provider && args[2] === authType && args[3] === model && args[4] === path,
    );
  }

  function insertedRows(): unknown[][] {
    return queryRunner.query.mock.calls
      .map(([, args]) => args)
      .filter((args): args is unknown[] => Array.isArray(args));
  }

  function jsonColumn(args: unknown[] | undefined, index: number): unknown {
    expect(args).toBeDefined();
    const value = args?.[index];
    expect(typeof value).toBe('string');
    return JSON.parse(value as string);
  }
});
