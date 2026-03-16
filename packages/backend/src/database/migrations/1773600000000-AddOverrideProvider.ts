import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOverrideProvider1773600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tier_assignments',
      new TableColumn({
        name: 'override_provider',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tier_assignments', 'override_provider');
  }
}
