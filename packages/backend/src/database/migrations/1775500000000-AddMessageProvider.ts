import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageProvider1775500000000 implements MigrationInterface {
  name = 'AddMessageProvider1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "provider" varchar DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "provider"`);
  }
}
