import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentRequestTimeout1773600000000 implements MigrationInterface {
  name = 'AddAgentRequestTimeout1773600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add request_timeout_ms column to agents table
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "request_timeout_ms" INTEGER DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove request_timeout_ms column from agents table
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "request_timeout_ms"`);
  }
}
