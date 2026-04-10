import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallerAttribution1775400000000 implements MigrationInterface {
  name = 'AddCallerAttribution1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "caller_attribution" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "caller_attribution"`);
  }
}
