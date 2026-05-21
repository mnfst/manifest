import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutingResponseMode1789300000000 implements MigrationInterface {
  name = 'AddRoutingResponseMode1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tier_assignments" ADD COLUMN "response_mode" varchar NOT NULL DEFAULT 'buffered'`,
    );
    await queryRunner.query(
      `ALTER TABLE "specificity_assignments" ADD COLUMN "response_mode" varchar NOT NULL DEFAULT 'buffered'`,
    );
    await queryRunner.query(
      `ALTER TABLE "header_tiers" ADD COLUMN "response_mode" varchar NOT NULL DEFAULT 'buffered'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "header_tiers" DROP COLUMN "response_mode"`);
    await queryRunner.query(`ALTER TABLE "specificity_assignments" DROP COLUMN "response_mode"`);
    await queryRunner.query(`ALTER TABLE "tier_assignments" DROP COLUMN "response_mode"`);
  }
}
