import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageFeedback1775600000000 implements MigrationInterface {
  name = 'AddMessageFeedback1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "feedback_rating" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "feedback_tags" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "feedback_details" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "feedback_details"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "feedback_tags"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "feedback_rating"`);
  }
}
