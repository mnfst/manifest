import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowGlobalOAuthPendingFlows1790500000002 implements MigrationInterface {
  name = 'AllowGlobalOAuthPendingFlows1790500000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_pending_flows" ALTER COLUMN "agent_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "oauth_pending_flows" WHERE "agent_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "oauth_pending_flows" ALTER COLUMN "agent_id" SET NOT NULL`,
    );
  }
}
