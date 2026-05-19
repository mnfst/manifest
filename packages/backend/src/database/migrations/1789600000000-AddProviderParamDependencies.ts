import { MigrationInterface, QueryRunner } from 'typeorm';

const THINKING_SAMPLING_DEPENDENCIES = [
  {
    effect: 'disable',
    when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
  },
  {
    effect: 'omit',
    when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
  },
];

export class AddProviderParamDependencies1789600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_param_specs"
        ADD COLUMN IF NOT EXISTS "dependencies" jsonb DEFAULT NULL
    `);
    await queryRunner.query(
      `
        UPDATE "provider_param_specs"
        SET "dependencies" = $1::jsonb,
            "updated_at" = now()
        WHERE "id" IN (
          'anthropic-api-key-base-top-p',
          'anthropic-api-key-base-top-k'
        )
      `,
      [JSON.stringify(THINKING_SAMPLING_DEPENDENCIES)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "provider_param_specs"
      SET "dependencies" = NULL,
          "updated_at" = now()
      WHERE "id" IN (
        'anthropic-api-key-base-top-p',
        'anthropic-api-key-base-top-k'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "provider_param_specs"
        DROP COLUMN IF EXISTS "dependencies"
    `);
  }
}
