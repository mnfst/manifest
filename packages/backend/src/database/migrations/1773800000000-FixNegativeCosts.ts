import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixNegativeCosts1773800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "agent_message" SET "cost_usd" = NULL WHERE "cost_usd" < 0`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible — cannot restore original negative values
  }
}
