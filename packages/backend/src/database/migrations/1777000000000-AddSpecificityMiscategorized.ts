import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a flag to agent_messages so users can mark a specificity-routed
 * message as miscategorized. These flags feed back into detection via
 * SpecificityPenaltyService, dampening categories that repeatedly fire on
 * unrelated content — see discussion #1613.
 */
export class AddSpecificityMiscategorized1777000000000 implements MigrationInterface {
  name = 'AddSpecificityMiscategorized1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "specificity_miscategorized" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_messages_miscategorized" ON "agent_messages" ("tenant_id", "agent_id", "specificity_category") WHERE "specificity_miscategorized" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_agent_messages_miscategorized"`);
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP COLUMN "specificity_miscategorized"`,
    );
  }
}
