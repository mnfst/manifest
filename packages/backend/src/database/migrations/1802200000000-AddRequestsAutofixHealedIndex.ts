import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial index over the requests Autofix repaired, for the CRM metrics feed.
 *
 * `GET /api/v1/internal/crm-metrics` groups every healed request by tenant.
 * No existing `requests` index mentions `autofix_status`, so the planner fell
 * back to a sequential scan: measured on production, 7,016,836 rows discarded
 * by the filter and 845,495 shared buffers (~6.6 GB) read to return 59 rows,
 * in 2.4s. `shared_buffers` there is ~128 MB, so the damage is not the latency
 * but the eviction — one call flushes the working set of every other query.
 *
 * Healed requests are a rounding error of the table (~8.3k of 7.0M), so a
 * partial index costs almost nothing to store, and turns that scan into a read
 * of a few hundred pages.
 *
 * `tenant_id` leads because the feed needs *every* healed row (the all-time
 * count takes no time bound) grouped by tenant, and because the same index
 * then serves `WHERE tenant_id = ANY(...)`. The timestamp-leading partial
 * index added in 1795100000000 solved the opposite shape — a narrow window
 * across all tenants — where a tenant-leading key forced a scan of every error
 * row ever. Revisit if healed rows ever approach seven figures.
 *
 * `status` is INCLUDEd rather than filtered from the heap: the feed applies the
 * canonical healed predicate (`sqlIsSuccessStatus` AND retry_succeeded, per
 * request-volume.service.ts), and carrying `status` in the index keeps that
 * check off the heap. `autofix_status` itself is deliberately absent — it is
 * constant inside a partial index and would be pure waste.
 *
 * Write-path cost is negligible despite the predicate column blocking HOT
 * updates: `status` is already indexed and already flips pending -> terminal on
 * every request, so those upserts are non-HOT today regardless.
 *
 * Built CONCURRENTLY (so `transaction = false`) to avoid the ACCESS EXCLUSIVE
 * lock that deadlocks against live writes during a deploy. Budget minutes for
 * this one: two heap passes over ~6.6 GB, and it blocks autovacuum on
 * `requests` while it runs.
 *
 * `npm run migration:revert` cannot run `down()` — TypeORM opens a transaction
 * for reverts regardless of `transaction = false`, and Postgres rejects
 * CONCURRENTLY inside one. Run the statement by hand and delete the row from
 * `migrations`.
 */
export class AddRequestsAutofixHealedIndex1802200000000 implements MigrationInterface {
  name = 'AddRequestsAutofixHealedIndex1802200000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clear any invalid leftover from an interrupted CONCURRENTLY build, since
    // CREATE ... IF NOT EXISTS matches on name and would skip over an INVALID
    // shell, leaving the feed permanently unindexed.
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_requests_autofix_healed"`);
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_requests_autofix_healed" ON "requests" ("tenant_id", "timestamp") INCLUDE ("status") WHERE "autofix_status" = 'retry_succeeded'`,
    );
    // The planner only picks the index if it believes the predicate is
    // selective; refresh the stats it reasons from before the first read.
    await queryRunner.query(`ANALYZE "requests"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_requests_autofix_healed"`);
  }
}
