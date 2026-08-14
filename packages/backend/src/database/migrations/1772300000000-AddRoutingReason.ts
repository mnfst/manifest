import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutingReason1772300000000 implements MigrationInterface {
  name = 'AddRoutingReason1772300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'routing_reason'`,
    );
    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "agent_messages" ADD COLUMN "routing_reason" character varying`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "routing_reason"`,
    );
  }
}
