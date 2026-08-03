import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist which API surface each Manifest Request arrived on
 * ('chat_completions' | 'responses' | 'messages'). The proxy already tracked it
 * in memory; the request log could not show it because it was never written.
 */
export class AddRequestApiMode1801720000000 implements MigrationInterface {
  name = 'AddRequestApiMode1801720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(`
      ALTER TABLE "requests"
        ADD COLUMN IF NOT EXISTS "api_mode" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(`
      ALTER TABLE "requests"
        DROP COLUMN IF EXISTS "api_mode"
    `);
  }
}
