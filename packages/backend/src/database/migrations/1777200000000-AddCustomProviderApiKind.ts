import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCustomProviderApiKind1777200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'custom_providers',
      new TableColumn({
        name: 'api_kind',
        type: 'varchar',
        isNullable: false,
        default: "'openai'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('custom_providers', 'api_kind');
  }
}
