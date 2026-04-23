import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentRecordMessages1777100000000 implements MigrationInterface {
  name = 'AddAgentRecordMessages1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "record_messages" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "record_messages"`);
  }
}
