import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpecificityCategory1775300000000 implements MigrationInterface {
  name = 'AddSpecificityCategory1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "specificity_category" varchar DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "specificity_category"`);
  }
}
