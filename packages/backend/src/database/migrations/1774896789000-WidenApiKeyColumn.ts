import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenApiKeyColumn1774896789000 implements MigrationInterface {
  name = 'WidenApiKeyColumn1774896789000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key" TYPE character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key" TYPE character varying(64) USING left("key", 64)`,
    );
  }
}
