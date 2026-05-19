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
  serializer: string | null,
  sortOrder: number,
];

export class AddProviderParamSpecs1789400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "provider_param_specs" (
        "id" varchar PRIMARY KEY,
        "provider" varchar NOT NULL,
        "auth_type" varchar NOT NULL,
        "model_name" varchar DEFAULT NULL,
        "param_key" varchar NOT NULL,
        "control_kind" varchar NOT NULL,
        "label" varchar NOT NULL,
        "default_value" jsonb NOT NULL,
        "values" jsonb DEFAULT NULL,
        "min_value" double precision DEFAULT NULL,
        "max_value" double precision DEFAULT NULL,
        "step_value" double precision DEFAULT NULL,
        "serializer" varchar DEFAULT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "chk_provider_param_specs_control_kind"
          CHECK ("control_kind" IN ('toggle', 'select', 'slider', 'number'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_provider_param_specs_route_key"
      ON "provider_param_specs" ("provider", "auth_type", COALESCE("model_name", ''), "param_key")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_provider_param_specs_lookup"
      ON "provider_param_specs" ("provider", "auth_type", "model_name", "sort_order")
    `);

    const rows: SeedRow[] = [
      [
        'anthropic-api-key-base-max-tokens',
        'anthropic',
        'api_key',
        null,
        'max_tokens',
        'number',
        'Max tokens',
        4096,
        null,
        1,
        null,
        null,
        null,
        10,
      ],
      [
        'anthropic-api-key-base-temperature',
        'anthropic',
        'api_key',
        null,
        'temperature',
        'slider',
        'Temperature',
        1,
        null,
        0,
        1,
        0.1,
        null,
        20,
      ],
      [
        'anthropic-api-key-base-top-p',
        'anthropic',
        'api_key',
        null,
        'top_p',
        'slider',
        'Top P',
        1,
        null,
        0,
        1,
        0.01,
        null,
        30,
      ],
      [
        'anthropic-api-key-base-top-k',
        'anthropic',
        'api_key',
        null,
        'top_k',
        'number',
        'Top K',
        0,
        null,
        0,
        null,
        null,
        null,
        40,
      ],
      [
        'deepseek-api-key-base-thinking',
        'deepseek',
        'api_key',
        null,
        'thinking',
        'toggle',
        'Thinking mode',
        'enabled',
        ['enabled', 'disabled'],
        null,
        null,
        null,
        null,
        10,
      ],
    ];

    for (const row of rows) {
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
        serializer,
        sortOrder,
      ] = row;
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
              "serializer",
              "sort_order"
            )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14)
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
            "serializer" = EXCLUDED."serializer",
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
          serializer,
          sortOrder,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_provider_param_specs_lookup"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_provider_param_specs_route_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_param_specs"`);
  }
}
