import { MigrationInterface, QueryRunner } from 'typeorm';

type GroupSeedRow = readonly [
  id: string,
  provider: string,
  authType: string,
  modelName: string | null,
  paramKey: string,
  groupKey: string,
  groupLabel: string,
  controlKind: string,
  label: string,
  defaultValue: unknown,
  values: readonly string[] | null,
  minValue: number | null,
  maxValue: number | null,
  stepValue: number | null,
  serializer: string | null,
  dependsOnKey: string | null,
  dependsOnValue: unknown,
  sortOrder: number,
];

export class AddProviderParamSpecGroups1789500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_param_specs"
        ADD COLUMN IF NOT EXISTS "group_key" varchar DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "group_label" varchar DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "depends_on_key" varchar DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "depends_on_value" jsonb DEFAULT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_provider_param_specs_group"
      ON "provider_param_specs" ("provider", "auth_type", "model_name", "group_key", "sort_order")
    `);

    const rows: GroupSeedRow[] = [
      [
        'anthropic-api-key-base-thinking-type',
        'anthropic',
        'api_key',
        null,
        'type',
        'thinking',
        'Thinking',
        'select',
        'Thinking mode',
        'disabled',
        ['disabled', 'adaptive', 'enabled'],
        null,
        null,
        null,
        'anthropic_thinking',
        null,
        null,
        50,
      ],
      [
        'anthropic-api-key-base-thinking-budget-tokens',
        'anthropic',
        'api_key',
        null,
        'budget_tokens',
        'thinking',
        'Thinking',
        'number',
        'Budget tokens',
        4096,
        null,
        1024,
        null,
        null,
        'anthropic_thinking',
        'type',
        'enabled',
        60,
      ],
    ];

    for (const row of rows) {
      const [
        id,
        provider,
        authType,
        modelName,
        paramKey,
        groupKey,
        groupLabel,
        controlKind,
        label,
        defaultValue,
        values,
        minValue,
        maxValue,
        stepValue,
        serializer,
        dependsOnKey,
        dependsOnValue,
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
              "group_key",
              "group_label",
              "control_kind",
              "label",
              "default_value",
              "values",
              "min_value",
              "max_value",
              "step_value",
              "serializer",
              "depends_on_key",
              "depends_on_value",
              "sort_order"
            )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17::jsonb, $18
          )
          ON CONFLICT ON CONSTRAINT "provider_param_specs_pkey" DO UPDATE
          SET
            "provider" = EXCLUDED."provider",
            "auth_type" = EXCLUDED."auth_type",
            "model_name" = EXCLUDED."model_name",
            "param_key" = EXCLUDED."param_key",
            "group_key" = EXCLUDED."group_key",
            "group_label" = EXCLUDED."group_label",
            "control_kind" = EXCLUDED."control_kind",
            "label" = EXCLUDED."label",
            "default_value" = EXCLUDED."default_value",
            "values" = EXCLUDED."values",
            "min_value" = EXCLUDED."min_value",
            "max_value" = EXCLUDED."max_value",
            "step_value" = EXCLUDED."step_value",
            "serializer" = EXCLUDED."serializer",
            "depends_on_key" = EXCLUDED."depends_on_key",
            "depends_on_value" = EXCLUDED."depends_on_value",
            "sort_order" = EXCLUDED."sort_order",
            "updated_at" = now()
        `,
        [
          id,
          provider,
          authType,
          modelName,
          paramKey,
          groupKey,
          groupLabel,
          controlKind,
          label,
          JSON.stringify(defaultValue),
          values === null ? null : JSON.stringify(values),
          minValue,
          maxValue,
          stepValue,
          serializer,
          dependsOnKey,
          dependsOnValue === null ? null : JSON.stringify(dependsOnValue),
          sortOrder,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "provider_param_specs"
      WHERE "id" IN (
        'anthropic-api-key-base-thinking-type',
        'anthropic-api-key-base-thinking-budget-tokens'
      )
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_provider_param_specs_group"`);
    await queryRunner.query(`
      ALTER TABLE "provider_param_specs"
        DROP COLUMN IF EXISTS "depends_on_value",
        DROP COLUMN IF EXISTS "depends_on_key",
        DROP COLUMN IF EXISTS "group_label",
        DROP COLUMN IF EXISTS "group_key"
    `);
  }
}
