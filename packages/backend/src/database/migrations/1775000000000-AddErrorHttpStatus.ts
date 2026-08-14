import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddErrorHttpStatus1775000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'agent_messages',
      new TableColumn({
        name: 'error_http_status',
        type: 'integer',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('agent_messages', 'error_http_status');
  }
}
