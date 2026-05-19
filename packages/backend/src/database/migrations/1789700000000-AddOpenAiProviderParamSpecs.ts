import { MigrationInterface, QueryRunner } from 'typeorm';

type SeedRow = readonly [
  id: string,
  provider: string,
  authType: string,
  modelName: string | null,
  paramKey: string,
  controlKind: string,
  label: string,
  defaultValue: unknown,
  values: readonly string[] | null,
  minValue: number | null,
  maxValue: number | null,
  stepValue: number | null,
  sortOrder: number,
];

type SpecTemplate = {
  key: string;
  kind: 'select' | 'slider' | 'number';
  label: string;
  defaultValue: unknown;
  values?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  sortOrder: number;
};

const MAX_TOKENS: SpecTemplate = {
  key: 'max_tokens',
  kind: 'number',
  label: 'Max tokens',
  defaultValue: 4096,
  min: 1,
  sortOrder: 10,
};

const TEMPERATURE: SpecTemplate = {
  key: 'temperature',
  kind: 'slider',
  label: 'Temperature',
  defaultValue: 1,
  min: 0,
  max: 2,
  step: 0.1,
  sortOrder: 20,
};

const TOP_P: SpecTemplate = {
  key: 'top_p',
  kind: 'slider',
  label: 'Top P',
  defaultValue: 1,
  min: 0,
  max: 1,
  step: 0.01,
  sortOrder: 30,
};

const REASONING_EFFORT: SpecTemplate = {
  key: 'reasoning_effort',
  kind: 'select',
  label: 'Reasoning effort',
  defaultValue: 'medium',
  values: ['minimal', 'low', 'medium', 'high'],
  sortOrder: 40,
};

const GPT_5_1_REASONING_EFFORT: SpecTemplate = {
  ...REASONING_EFFORT,
  defaultValue: 'none',
  values: ['none', 'low', 'medium', 'high'],
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

const OPENAI_GPT5_REASONING_MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-chat-latest',
  'gpt-5.2',
  'gpt-5.4',
] as const;

const OPENAI_GPT51_REASONING_MODELS = ['gpt-5.1'] as const;

function row(modelName: string | null, template: SpecTemplate): SeedRow {
  const modelPart = modelName ? modelName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'base';
  return [
    `openai-api-key-${modelPart}-${template.key.replace(/_/g, '-')}`,
    'openai',
    'api_key',
    modelName,
    template.key,
    template.kind,
    template.label,
    template.defaultValue,
    template.values ?? null,
    template.min ?? null,
    template.max ?? null,
    template.step ?? null,
    template.sortOrder,
  ];
}

function openAiParamRows(): SeedRow[] {
  return [
    row(null, MAX_TOKENS),
    ...OPENAI_CHAT_SAMPLING_MODELS.flatMap((model) =>
      [MAX_TOKENS, TEMPERATURE, TOP_P].map((spec) => row(model, spec)),
    ),
    ...OPENAI_O_SERIES_REASONING_MODELS.flatMap((model) =>
      [MAX_TOKENS, REASONING_EFFORT].map((spec) => row(model, spec)),
    ),
    ...OPENAI_GPT5_REASONING_MODELS.flatMap((model) =>
      [MAX_TOKENS, TEMPERATURE, TOP_P, REASONING_EFFORT].map((spec) => row(model, spec)),
    ),
    ...OPENAI_GPT51_REASONING_MODELS.flatMap((model) =>
      [MAX_TOKENS, TEMPERATURE, TOP_P, GPT_5_1_REASONING_EFFORT].map((spec) => row(model, spec)),
    ),
  ];
}

export class AddOpenAiProviderParamSpecs1789700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = openAiParamRows();

    for (const seed of rows) {
      const [
        id,
        provider,
        authType,
        modelName,
        paramKey,
        controlKind,
        label,
        defaultValue,
        values,
        minValue,
        maxValue,
        stepValue,
        sortOrder,
      ] = seed;
      await queryRunner.query(
        `
          INSERT INTO "provider_param_specs"
            (
              "id",
              "provider",
              "auth_type",
              "model_name",
              "param_key",
              "control_kind",
              "label",
              "default_value",
              "values",
              "min_value",
              "max_value",
              "step_value",
              "sort_order"
            )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13)
          ON CONFLICT ON CONSTRAINT "provider_param_specs_pkey" DO UPDATE
          SET
            "provider" = EXCLUDED."provider",
            "auth_type" = EXCLUDED."auth_type",
            "model_name" = EXCLUDED."model_name",
            "param_key" = EXCLUDED."param_key",
            "control_kind" = EXCLUDED."control_kind",
            "label" = EXCLUDED."label",
            "default_value" = EXCLUDED."default_value",
            "values" = EXCLUDED."values",
            "min_value" = EXCLUDED."min_value",
            "max_value" = EXCLUDED."max_value",
            "step_value" = EXCLUDED."step_value",
            "serializer" = NULL,
            "dependencies" = NULL,
            "sort_order" = EXCLUDED."sort_order",
            "updated_at" = now()
        `,
        [
          id,
          provider,
          authType,
          modelName,
          paramKey,
          controlKind,
          label,
          JSON.stringify(defaultValue),
          values === null ? null : JSON.stringify(values),
          minValue,
          maxValue,
          stepValue,
          sortOrder,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = openAiParamRows().map(([id]) => id);
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    await queryRunner.query(
      `
      DELETE FROM "provider_param_specs"
      WHERE "id" IN (${placeholders})
    `,
      ids,
    );
  }
}
