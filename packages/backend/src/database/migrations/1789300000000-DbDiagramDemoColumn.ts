import { MigrationInterface, QueryRunner } from 'typeorm';

export class DbDiagramDemoColumn1789300000000 implements MigrationInterface {
  name = 'DbDiagramDemoColumn1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" ADD "db_diagram_notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "db_diagram_notes"`);
  }
}
