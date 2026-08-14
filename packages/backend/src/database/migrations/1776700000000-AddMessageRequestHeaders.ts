import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageRequestHeaders1776700000000 implements MigrationInterface {
  name = 'AddMessageRequestHeaders1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "request_headers" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "request_headers"`);
  }
}
