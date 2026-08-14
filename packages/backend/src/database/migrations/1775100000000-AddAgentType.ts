import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAgentType1775100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'agent_category',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'agent_platform',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.query(
      `UPDATE agents SET agent_category = 'personal', agent_platform = 'openclaw' WHERE agent_category IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('agents', 'agent_platform');
    await queryRunner.dropColumn('agents', 'agent_category');
  }
}
