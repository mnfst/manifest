import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOverrideAuthType1773100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tier_assignments',
      new TableColumn({
        name: 'override_auth_type',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tier_assignments', 'override_auth_type');
  }
}
