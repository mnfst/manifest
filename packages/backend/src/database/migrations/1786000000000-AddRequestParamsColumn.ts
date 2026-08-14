import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a nullable `request_params` JSONB column to agent_messages. Stores a
 * per-message snapshot of the configured/effective request body parameters
 * (today: DeepSeek's `thinking: { type: 'enabled' | 'disabled' }`; future
 * provider-specific knobs append here without schema changes). The column is
 * nullable because most rows pre-date the feature and most requests don't
 * carry any param defaults; an empty object would be misleading telemetry.
 */
export class AddRequestParamsColumn1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "request_params" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "request_params"`);
  }
}
