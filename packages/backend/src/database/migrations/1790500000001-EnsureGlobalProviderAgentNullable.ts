import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureGlobalProviderAgentNullable1790500000001 implements MigrationInterface {
  name = 'EnsureGlobalProviderAgentNullable1790500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user_providers" WHERE "agent_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "user_providers" ALTER COLUMN "agent_id" SET NOT NULL`);
  }
}
