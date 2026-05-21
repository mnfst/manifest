import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultRecordMessagesTrue1786300000000 implements MigrationInterface {
  name = 'DefaultRecordMessagesTrue1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" ALTER COLUMN "record_messages" SET DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ALTER COLUMN "record_messages" SET DEFAULT false`,
    );
  }
}
