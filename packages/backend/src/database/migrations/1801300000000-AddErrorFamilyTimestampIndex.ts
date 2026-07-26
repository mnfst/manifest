import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the cross-tenant error-scan index to the request-first status
 * vocabulary. The request-first model (mnfst/manifest#2485, deployed
 * 2026-07-21) records failures as `failed` (with Auto-fix marking healed
 * originals `auto_fixed`), but IDX_agent_messages_errors_timestamp only
 * covers the legacy trio ('error', 'fallback_error', 'rate_limited'). A
 * partial index is usable only when the query predicate implies the index
 * predicate, so any consumer that (correctly) filters the full five-status
 * error family gets NO index at all and falls back to scanning every row in
 * the window — the multi-minute cross-tenant scans the trio index was built
 * to kill (see 1795100000000).
 *
 * The five-status replacement is built first, then the legacy trio index is
 * dropped: every trio query implies the wider predicate, so error scans stay
 * index-served during and after the swap.
 *
 * Built CONCURRENTLY (so `transaction = false`) to avoid the ACCESS EXCLUSIVE
 * lock that deadlocks against live writes during a deploy.
 */
export class AddErrorFamilyTimestampIndex1801300000000 implements MigrationInterface {
  name = 'AddErrorFamilyTimestampIndex1801300000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clear any invalid leftover from an interrupted CONCURRENTLY build, since
    // CREATE ... IF NOT EXISTS would otherwise skip over an invalid index.
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_error_family_timestamp"`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_error_family_timestamp" ON "agent_messages" ("timestamp") WHERE "status" IN ('error', 'fallback_error', 'rate_limited', 'auto_fixed', 'failed')`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_errors_timestamp"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_agent_messages_error_family_timestamp"`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_errors_timestamp" ON "agent_messages" ("timestamp") WHERE "status" IN ('error', 'fallback_error', 'rate_limited')`,
    );
  }
}
