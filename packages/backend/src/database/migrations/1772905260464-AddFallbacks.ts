import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFallbacks1772905260464 implements MigrationInterface {
  name = 'AddFallbacks1772905260464';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tier_assignments" ADD COLUMN "fallback_models" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "fallback_from_model" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN "fallback_index" integer DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "fallback_index"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN "fallback_from_model"`);
    await queryRunner.query(`ALTER TABLE "tier_assignments" DROP COLUMN "fallback_models"`);
  }
}
