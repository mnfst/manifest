import { MigrationInterface, QueryRunner } from 'typeorm';
import type {
  JsonValue,
  ModelParamGroup,
  ModelParamRange,
  ModelParamType,
  ParamApplicability,
} from 'manifest-shared';

type SeedSpec = {
  path: string;
  type: ModelParamType;
  label: string;
  defaultValue: JsonValue;
  values?: readonly JsonValue[];
  range?: ModelParamRange;
  group: ModelParamGroup;
  applicability?: ParamApplicability;
};

type SeedRow = SeedSpec & {
  provider: string;
  authType: string;
  model: string;
};

const MAX_TOKENS: SeedSpec = {
  path: 'max_tokens',
  type: 'integer',
  label: 'Max tokens',
  defaultValue: 4096,
  range: { min: 1 },
  group: 'generation_length',
};

const OPENAI_TEMPERATURE: SeedSpec = {
  path: 'temperature',
  type: 'number',
  label: 'Temperature',
  defaultValue: 1,
  range: { min: 0, max: 2, step: 0.1 },
  group: 'sampling',
};

const ANTHROPIC_TEMPERATURE: SeedSpec = {
  ...OPENAI_TEMPERATURE,
  range: { min: 0, max: 1, step: 0.1 },
  applicability: { except: { 'thinking.type': ['adaptive', 'enabled'] } },
};

const TOP_P: SeedSpec = {
  path: 'top_p',
  type: 'number',
  label: 'Top P',
  defaultValue: 1,
  range: { min: 0, max: 1, step: 0.01 },
  group: 'sampling',
};

const ANTHROPIC_TOP_P: SeedSpec = {
  ...TOP_P,
  applicability: {
    except: [{ 'thinking.type': ['adaptive', 'enabled'] }, { temperature: { not: 1 } }],
  },
};

const TOP_K: SeedSpec = {
  path: 'top_k',
  type: 'integer',
  label: 'Top K',
  defaultValue: 0,
  range: { min: 0 },
  group: 'sampling',
  applicability: { except: { 'thinking.type': ['adaptive', 'enabled'] } },
};

const OPENAI_REASONING_EFFORT: SeedSpec = {
  path: 'reasoning_effort',
  type: 'enum',
  label: 'Reasoning effort',
  defaultValue: 'medium',
  values: ['minimal', 'low', 'medium', 'high'],
  group: 'reasoning',
};

const OPENAI_XHIGH_REASONING_EFFORT: SeedSpec = {
  ...OPENAI_REASONING_EFFORT,
  values: ['minimal', 'low', 'medium', 'high', 'xhigh'],
};

const OPENAI_GPT_5_1_REASONING_EFFORT: SeedSpec = {
  ...OPENAI_REASONING_EFFORT,
  defaultValue: 'none',
  values: ['none', 'low', 'medium', 'high'],
};

const OPENAI_SUBSCRIPTION_REASONING_EFFORT: SeedSpec = {
  path: 'reasoning.effort',
  type: 'enum',
  label: 'Reasoning effort',
  defaultValue: 'medium',
  values: ['minimal', 'low', 'medium', 'high'],
  group: 'reasoning',
};

const OPENAI_SUBSCRIPTION_XHIGH_REASONING_EFFORT: SeedSpec = {
  ...OPENAI_SUBSCRIPTION_REASONING_EFFORT,
  values: ['minimal', 'low', 'medium', 'high', 'xhigh'],
};

const OPENAI_SUBSCRIPTION_REASONING_SUMMARY: SeedSpec = {
  path: 'reasoning.summary',
  type: 'enum',
  label: 'Reasoning summary',
  defaultValue: 'auto',
  values: ['auto', 'concise', 'detailed', 'none'],
  group: 'reasoning',
};

const OPENAI_SUBSCRIPTION_VERBOSITY: SeedSpec = {
  path: 'text.verbosity',
  type: 'enum',
  label: 'Verbosity',
  defaultValue: 'medium',
  values: ['low', 'medium', 'high'],
  group: 'output_format',
};

const THINKING_TYPE_ADAPTIVE_ONLY: SeedSpec = {
  path: 'thinking.type',
  type: 'enum',
  label: 'Thinking mode',
  defaultValue: 'disabled',
  values: ['disabled', 'adaptive'],
  group: 'reasoning',
};

const THINKING_TYPE_EXTENDED_ONLY: SeedSpec = {
  ...THINKING_TYPE_ADAPTIVE_ONLY,
  values: ['disabled', 'enabled'],
};

const THINKING_TYPE_FULL: SeedSpec = {
  ...THINKING_TYPE_ADAPTIVE_ONLY,
  values: ['disabled', 'adaptive', 'enabled'],
};

const THINKING_BUDGET_TOKENS: SeedSpec = {
  path: 'thinking.budget_tokens',
  type: 'integer',
  label: 'Budget tokens',
  defaultValue: 4096,
  range: { min: 1024 },
  group: 'reasoning',
  applicability: { only: { 'thinking.type': 'enabled' } },
};

const DEEPSEEK_THINKING: SeedSpec = {
  path: 'thinking.type',
  type: 'enum',
  label: 'Thinking mode',
  defaultValue: 'enabled',
  values: ['enabled', 'disabled'],
  group: 'reasoning',
};

const OPENAI_CHAT_SAMPLING_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-11-20',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-3.5-turbo',
  'chatgpt-4o-latest',
] as const;

const OPENAI_O_SERIES_REASONING_MODELS = [
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini',
  'o4-mini',
] as const;

const OPENAI_GPT_5_REASONING_MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-chat-latest',
] as const;

const OPENAI_GPT_5_XHIGH_REASONING_MODELS = [
  'gpt-5.2',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.5',
] as const;

const OPENAI_GPT_5_1_REASONING_MODELS = ['gpt-5.1'] as const;

const OPENAI_SUBSCRIPTION_XHIGH_REASONING_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2-codex',
  'gpt-5.2',
  'gpt-5.1-codex-max',
] as const;

const OPENAI_SUBSCRIPTION_MODELS = ['gpt-5.1-codex'] as const;

const ANTHROPIC_ADAPTIVE_ONLY_MODELS = ['claude-opus-4-7'] as const;

const ANTHROPIC_FULL_THINKING_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4',
  'claude-sonnet-4',
] as const;

const ANTHROPIC_EXTENDED_ONLY_MODELS = [
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-haiku-4',
  'claude-3-7-sonnet-latest',
  'claude-3-7-sonnet-20250219',
] as const;

const ANTHROPIC_SAMPLING_ONLY_MODELS = [
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-latest',
  'claude-3-opus-20240229',
] as const;

const ANTHROPIC_SUBSCRIPTION_FULL_THINKING_MODELS = ['claude-opus-4', 'claude-sonnet-4'] as const;

const ANTHROPIC_SUBSCRIPTION_EXTENDED_ONLY_MODELS = ['claude-haiku-4'] as const;

const DEEPSEEK_THINKING_MODELS = [
  'deepseek-chat',
  'deepseek-v3.1',
  'deepseek-v3.2',
  'deepseek-v4',
] as const;

export class AddProviderParamCapabilities1789300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "provider_param_specs" (
        "id" varchar PRIMARY KEY,
        "provider" varchar NOT NULL,
        "auth_type" varchar NOT NULL,
        "model_name" varchar NOT NULL,
        "param_path" varchar NOT NULL,
        "param_type" varchar NOT NULL,
        "label" varchar NOT NULL,
        "default_value" jsonb NOT NULL,
        "values" jsonb DEFAULT NULL,
        "range" jsonb DEFAULT NULL,
        "param_group" varchar NOT NULL,
        "applicability" jsonb DEFAULT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "chk_provider_param_specs_type"
          CHECK ("param_type" IN ('boolean', 'enum', 'integer', 'number', 'string')),
        CONSTRAINT "chk_provider_param_specs_group"
          CHECK ("param_group" IN (
            'generation_length',
            'sampling',
            'reasoning',
            'tooling',
            'output_format',
            'observability',
            'provider_metadata'
          ))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_provider_param_specs_route_path"
      ON "provider_param_specs" ("provider", "auth_type", "model_name", "param_path")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_provider_param_specs_lookup"
      ON "provider_param_specs" ("provider", "auth_type", "model_name", "param_group")
    `);

    for (const row of providerParamRows()) {
      await queryRunner.query(
        `
          INSERT INTO "provider_param_specs"
            (
              "id",
              "provider",
              "auth_type",
              "model_name",
              "param_path",
              "param_type",
              "label",
              "default_value",
              "values",
              "range",
              "param_group",
              "applicability"
            )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12::jsonb)
          ON CONFLICT ON CONSTRAINT "provider_param_specs_pkey" DO UPDATE
          SET
            "provider" = EXCLUDED."provider",
            "auth_type" = EXCLUDED."auth_type",
            "model_name" = EXCLUDED."model_name",
            "param_path" = EXCLUDED."param_path",
            "param_type" = EXCLUDED."param_type",
            "label" = EXCLUDED."label",
            "default_value" = EXCLUDED."default_value",
            "values" = EXCLUDED."values",
            "range" = EXCLUDED."range",
            "param_group" = EXCLUDED."param_group",
            "applicability" = EXCLUDED."applicability",
            "updated_at" = now()
        `,
        [
          rowId(row),
          row.provider,
          row.authType,
          row.model,
          row.path,
          row.type,
          row.label,
          JSON.stringify(row.defaultValue),
          row.values ? JSON.stringify(row.values) : null,
          row.range ? JSON.stringify(row.range) : null,
          row.group,
          row.applicability ? JSON.stringify(row.applicability) : null,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_provider_param_specs_lookup"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_provider_param_specs_route_path"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_param_specs"`);
  }
}

function providerParamRows(): SeedRow[] {
  return [
    ...OPENAI_CHAT_SAMPLING_MODELS.flatMap((model) =>
      openAiRows(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P]),
    ),
    ...OPENAI_O_SERIES_REASONING_MODELS.flatMap((model) =>
      openAiRows(model, [MAX_TOKENS, OPENAI_REASONING_EFFORT]),
    ),
    ...OPENAI_GPT_5_REASONING_MODELS.flatMap((model) =>
      openAiRows(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P, OPENAI_REASONING_EFFORT]),
    ),
    ...OPENAI_GPT_5_XHIGH_REASONING_MODELS.flatMap((model) =>
      openAiRows(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P, OPENAI_XHIGH_REASONING_EFFORT]),
    ),
    ...OPENAI_GPT_5_1_REASONING_MODELS.flatMap((model) =>
      openAiRows(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P, OPENAI_GPT_5_1_REASONING_EFFORT]),
    ),
    ...OPENAI_SUBSCRIPTION_MODELS.flatMap((model) =>
      openAiRowsForAuth('subscription', model, [
        OPENAI_SUBSCRIPTION_REASONING_EFFORT,
        OPENAI_SUBSCRIPTION_REASONING_SUMMARY,
        OPENAI_SUBSCRIPTION_VERBOSITY,
      ]),
    ),
    ...OPENAI_SUBSCRIPTION_XHIGH_REASONING_MODELS.flatMap((model) =>
      openAiRowsForAuth('subscription', model, [
        OPENAI_SUBSCRIPTION_XHIGH_REASONING_EFFORT,
        OPENAI_SUBSCRIPTION_REASONING_SUMMARY,
        OPENAI_SUBSCRIPTION_VERBOSITY,
      ]),
    ),
    ...ANTHROPIC_ADAPTIVE_ONLY_MODELS.flatMap((model) =>
      anthropicRows(model, [THINKING_TYPE_ADAPTIVE_ONLY]),
    ),
    ...ANTHROPIC_FULL_THINKING_MODELS.flatMap((model) =>
      anthropicRows(model, [THINKING_TYPE_FULL, THINKING_BUDGET_TOKENS]),
    ),
    ...ANTHROPIC_EXTENDED_ONLY_MODELS.flatMap((model) =>
      anthropicRows(model, [THINKING_TYPE_EXTENDED_ONLY, THINKING_BUDGET_TOKENS]),
    ),
    ...ANTHROPIC_SAMPLING_ONLY_MODELS.flatMap((model) => anthropicRows(model, [])),
    ...ANTHROPIC_SUBSCRIPTION_FULL_THINKING_MODELS.flatMap((model) =>
      anthropicRowsForAuth('subscription', model, [THINKING_TYPE_FULL, THINKING_BUDGET_TOKENS]),
    ),
    ...ANTHROPIC_SUBSCRIPTION_EXTENDED_ONLY_MODELS.flatMap((model) =>
      anthropicRowsForAuth('subscription', model, [
        THINKING_TYPE_EXTENDED_ONLY,
        THINKING_BUDGET_TOKENS,
      ]),
    ),
    ...DEEPSEEK_THINKING_MODELS.map((model) =>
      row('deepseek', 'api_key', model, DEEPSEEK_THINKING),
    ),
  ];
}

function openAiRows(model: string, specs: readonly SeedSpec[]): SeedRow[] {
  return openAiRowsForAuth('api_key', model, specs);
}

function openAiRowsForAuth(
  authType: 'api_key' | 'subscription',
  model: string,
  specs: readonly SeedSpec[],
): SeedRow[] {
  return specs.map((spec) => row('openai', authType, model, spec));
}

function anthropicRows(model: string, reasoningSpecs: readonly SeedSpec[]): SeedRow[] {
  return anthropicRowsForAuth('api_key', model, reasoningSpecs);
}

function anthropicRowsForAuth(
  authType: 'api_key' | 'subscription',
  model: string,
  reasoningSpecs: readonly SeedSpec[],
): SeedRow[] {
  return [MAX_TOKENS, ANTHROPIC_TEMPERATURE, ANTHROPIC_TOP_P, TOP_K, ...reasoningSpecs].map(
    (spec) => row('anthropic', authType, model, spec),
  );
}

function row(provider: string, authType: string, model: string, spec: SeedSpec): SeedRow {
  return {
    provider,
    authType,
    model,
    ...spec,
  };
}

function rowId(row: SeedRow): string {
  return [row.provider, row.authType, row.model, row.path]
    .join('-')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}
