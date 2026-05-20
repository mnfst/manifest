import { MigrationInterface, QueryRunner } from 'typeorm';

export class TestDbDiagramBot1789200000000 implements MigrationInterface {
  name = 'TestDbDiagramBot1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" ADD "diagram_test_flag" boolean DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "diagram_test_flag"`);
  }
}
