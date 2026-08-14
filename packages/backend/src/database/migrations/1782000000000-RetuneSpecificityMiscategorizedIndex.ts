import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces IDX_agent_messages_miscategorized with one keyed by agent_id first.
 * SpecificityPenaltyService runs on every resolve when specificity is active
 * and filters by agent_id (no tenant_id), so a leading tenant_id column made
 * the previous partial index unhelpful.
 *
 * Note on locking: the rebuild runs inside a transaction (database.module.ts
 * pins migrationsTransactionMode = 'all', so per-migration transaction = false
 * is rejected). The window is brief because this is a partial index covering
 * only flagged rows — typically a tiny fraction of agent_messages — so the
 * write block during boot is bounded to milliseconds. Operators worried about
 * even that can pre-create the new index manually with CREATE INDEX
 * CONCURRENTLY before deploying, which makes this migration a no-op.
 */
export class RetuneSpecificityMiscategorizedIndex1782000000000 implements MigrationInterface {
  name = 'RetuneSpecificityMiscategorizedIndex1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_miscategorized"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_miscategorized" ON "agent_messages" ("agent_id", "specificity_category") WHERE "specificity_miscategorized" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_miscategorized"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_miscategorized" ON "agent_messages" ("tenant_id", "agent_id", "specificity_category") WHERE "specificity_miscategorized" = true`,
    );
  }
}
