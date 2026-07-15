import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove the legacy relation name after every replica runs the request/attempt
 * schema. Deploy this only after AddRequestsAndProviderAttempts has reached
 * production and the previous release has fully drained.
 */
export class DropAgentMessagesCompatibilityView1801100000000 implements MigrationInterface {
  name = 'DropAgentMessagesCompatibilityView1801100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Abort the cleanup deploy instead of waiting behind an old replica that is
    // still using the compatibility view.
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(`DROP VIEW IF EXISTS "agent_messages"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.agent_messages') IS NULL
           AND to_regclass('public.provider_attempts') IS NOT NULL THEN
          CREATE VIEW "agent_messages" AS SELECT * FROM "provider_attempts";
        END IF;
      END $$
    `);
  }
}
