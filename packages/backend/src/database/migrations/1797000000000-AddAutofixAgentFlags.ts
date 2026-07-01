import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the per-agent Auto-fix controls to the `agents` table:
 * - `autofix_enabled`      — opt-in toggle (default off).
 * - `autofix_max_attempts` — how many patched retries to try (default 3).
 */
export class AddAutofixAgentFlags1797000000000 implements MigrationInterface {
  name = 'AddAutofixAgentFlags1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "autofix_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "autofix_max_attempts" integer NOT NULL DEFAULT 3`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "autofix_max_attempts"`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "autofix_enabled"`);
  }
}
