import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Covering index for the provider-usage aggregation (ProviderUsageService):
 * `(tenant_id, timestamp) INCLUDE (provider, auth_type, input_tokens,
 * output_tokens, cost_usd)`. The 30-day window scan filters on
 * (tenant_id, timestamp) and only ever reads those five payload columns, so an
 * INCLUDE index lets Postgres satisfy the whole query index-only — no random
 * heap fetches, which is exactly the 7s of latency this PR removes.
 *
 * LOCKING — why this migration is size-guarded rather than a plain CREATE INDEX:
 * agent_messages is ~8GB / millions of rows on production. A plain (non-partial,
 * full-table) `CREATE INDEX` takes an ACCESS EXCLUSIVE lock for the entire
 * build, which on a table that size means minutes of blocked writes during boot.
 * `CREATE INDEX CONCURRENTLY` avoids the long lock but CANNOT run inside a
 * transaction, and this repo pins `migrationsTransactionMode: 'all'`
 * (database.module.ts) so every migration runs in one shared transaction —
 * issuing CONCURRENTLY here would throw `CREATE INDEX CONCURRENTLY cannot run
 * inside a transaction block` and brick boot.
 *
 * Resolution:
 *  - On a SMALL table (fresh installs, dev, CI, tests) the inline build is
 *    effectively instant and safe, so we create it normally and the system is
 *    correct everywhere out of the box.
 *  - On a LARGE table we SKIP the inline build and log a clear warning. An
 *    operator must create it out-of-band, once, with:
 *
 *      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_agent_messages_provider_usage"
 *        ON "agent_messages" ("tenant_id", "timestamp")
 *        INCLUDE ("provider", "auth_type", "input_tokens", "output_tokens", "cost_usd");
 *
 *    (run outside any transaction, e.g. via psql). Once present, this migration
 *    and the manual command are both no-ops thanks to IF NOT EXISTS.
 *
 * The endpoint stays correct without the index — it's purely a performance
 * optimisation — so skipping on large tables never breaks functionality.
 */
const INDEX_NAME = 'IDX_agent_messages_provider_usage';

// Below this estimated row count the inline build is fast enough to run during
// boot without a meaningful write-stall. Tuned conservatively: even at ~1M rows
// a covering-index build is seconds, but we keep a wide safety margin so large
// production tables are never blocked at startup.
const INLINE_BUILD_ROW_LIMIT = 500_000;

const CREATE_INDEX_SQL =
  `CREATE INDEX IF NOT EXISTS "${INDEX_NAME}" ` +
  `ON "agent_messages" ("tenant_id", "timestamp") ` +
  `INCLUDE ("provider", "auth_type", "input_tokens", "output_tokens", "cost_usd")`;

export class AddProviderUsageCoveringIndex1792900000000 implements MigrationInterface {
  name = 'AddProviderUsageCoveringIndex1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Already created out-of-band (operator ran CONCURRENTLY) → nothing to do.
    const existing = await queryRunner.query(
      `SELECT 1 FROM pg_class WHERE relname = '${INDEX_NAME}' AND relkind = 'i' LIMIT 1`,
    );
    if (Array.isArray(existing) && existing.length > 0) return;

    // reltuples is the planner's row estimate (negative/zero before the first
    // ANALYZE on a brand-new table); treat a non-positive estimate as "small".
    const rows = await queryRunner.query(
      `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'agent_messages' AND relkind = 'r' LIMIT 1`,
    );
    const estimate = Array.isArray(rows) && rows.length > 0 ? Number(rows[0].estimate) || 0 : 0;

    if (estimate > INLINE_BUILD_ROW_LIMIT) {
      console.warn(
        `[migration ${this.name}] agent_messages has ~${estimate} rows; skipping inline ` +
          `index build to avoid a long boot-time write lock. Apply "${INDEX_NAME}" ` +
          `out-of-band with CREATE INDEX CONCURRENTLY (see the migration file header).`,
      );
      return;
    }

    await queryRunner.query(CREATE_INDEX_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${INDEX_NAME}"`);
  }
}
