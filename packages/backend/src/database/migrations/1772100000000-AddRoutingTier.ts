import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutingTier1772100000000 implements MigrationInterface {
  name = 'AddRoutingTier1772100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'routing_tier'`,
    );
    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "agent_messages" ADD COLUMN "routing_tier" character varying`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "routing_tier"`,
    );
  }
}
