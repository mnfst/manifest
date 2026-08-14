import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRecordMessagesForAll1789300000000 implements MigrationInterface {
  name = 'EnableRecordMessagesForAll1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE agents SET record_messages = true WHERE record_messages = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: we cannot know which agents had recording disabled before.
  }
}
