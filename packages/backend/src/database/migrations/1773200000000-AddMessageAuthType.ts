import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMessageAuthType1773200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'agent_messages',
      new TableColumn({
        name: 'auth_type',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('agent_messages', 'auth_type');
  }
}
