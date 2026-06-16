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
    // Scope the existence probe to the index ATTACHED TO agent_messages: a
    // same-named index on another table/schema must not produce a false positive
    // that skips the required build. pg_index.indrelid ties the index to its
    // table, and ::regclass resolves agent_messages in the search_path.
    const existing = await queryRunner.query(
      `SELECT 1 FROM pg_index i JOIN pg_class ix ON ix.oid = i.indexrelid ` +
        `WHERE ix.relname = '${INDEX_NAME}' AND i.indrelid = 'agent_messages'::regclass LIMIT 1`,
    );
    if (Array.isArray(existing) && existing.length > 0) return;

    // Decide inline-vs-skip from the table's size. reltuples is the planner's
    // row estimate but is non-positive (typically -1) until the first
    // ANALYZE/VACUUM — and crucially that's true for a HUGE table that simply
    // hasn't been analysed yet, not just a fresh empty one. Treating any
    // non-positive estimate as "small" would force an inline CREATE INDEX on a
    // large unanalysed table and block writes during boot (the exact hazard
    // this guard exists to avoid). So when reltuples is unavailable we fall back
    // to relpages (physical 8KB pages), which is 0 for a genuinely empty/new
    // table and large for a populated-but-unanalysed one. Only build inline when
    // BOTH signals say the table is small.
    const rows = await queryRunner.query(
      `SELECT reltuples::bigint AS estimate, relpages::bigint AS pages ` +
        `FROM pg_class WHERE relname = 'agent_messages' AND relkind = 'r' LIMIT 1`,
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined;
    const estimate = row ? Number(row.estimate) : 0;
    const pages = row ? Number(row.pages) : 0;

    // Below this page count the table is small enough that an inline build is
    // effectively instant even without a usable reltuples estimate. ~8KB/page,
    // so 4000 pages ≈ 32MB of heap — comfortably fast to index at boot.
    const INLINE_BUILD_PAGE_LIMIT = 4000;

    const tooManyRows = Number.isFinite(estimate) && estimate > INLINE_BUILD_ROW_LIMIT;
    // When reltuples is non-positive (unknown/unanalysed) defer to relpages so a
    // large unanalysed table is correctly classified as large.
    const unknownRowCount = !Number.isFinite(estimate) || estimate <= 0;
    const tooManyPages =
      unknownRowCount && Number.isFinite(pages) && pages > INLINE_BUILD_PAGE_LIMIT;

    if (tooManyRows || tooManyPages) {
      const size = tooManyRows ? `~${estimate} rows` : `~${pages} pages (row estimate unavailable)`;
      console.warn(
        `[migration ${this.name}] agent_messages has ${size}; skipping inline ` +
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
