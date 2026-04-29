import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Benchmark calls recorded before `AddBenchmarkHistory1777300000000` and
 * before the tier-promotion code change used `routing_tier = NULL` with
 * `routing_reason = 'benchmark'` as the marker. The new behaviour uses
 * `routing_tier = 'benchmark'` and leaves `routing_reason` null so the
 * Messages tier badge renders consistently. This migration retro-tags the
 * old rows so the UI stops treating them as "unknown tier".
 *
 * Idempotent: running it a second time is a no-op because the WHERE clause
 * only matches untagged-benchmark rows.
 *
 * Batched: TypeORM runs migrations inside a single boot transaction. On a
 * multi-million-row `agent_messages` an unbounded UPDATE would hold a long
 * write lock and balloon the WAL. Batches of 5 000 keep the lock window
 * short and let the transaction commit a reasonable amount of work even
 * on first deployment to a large existing dataset.
 */
const BACKFILL_BATCH_SIZE = 5_000;
const MAX_BATCHES = 10_000; // safety net: 50M rows max before bailing.

export class BackfillBenchmarkTier1777400000000 implements MigrationInterface {
  name = 'BackfillBenchmarkTier1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runInBatches(
      queryRunner,
      `UPDATE "agent_messages"
       SET "routing_tier" = 'benchmark',
           "routing_reason" = NULL
       WHERE "id" IN (
         SELECT "id" FROM "agent_messages"
         WHERE "routing_reason" = 'benchmark'
           AND "routing_tier" IS NULL
         LIMIT $1
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Caveat: this revert re-tags every `routing_tier='benchmark'` row —
    // including rows that were always correct under the new scheme. We
    // can't tell "originally-backfilled" and "originally-correct" apart
    // because both look identical post-up(). Acceptable because (a)
    // benchmark rows are ephemeral side-by-side experiments, and (b) we
    // only ever call down() in local dev or CI.
    await this.runInBatches(
      queryRunner,
      `UPDATE "agent_messages"
       SET "routing_tier" = NULL,
           "routing_reason" = 'benchmark'
       WHERE "id" IN (
         SELECT "id" FROM "agent_messages"
         WHERE "routing_tier" = 'benchmark'
           AND "routing_reason" IS NULL
         LIMIT $1
       )`,
    );
  }

  private async runInBatches(queryRunner: QueryRunner, sql: string): Promise<void> {
    for (let i = 0; i < MAX_BATCHES; i++) {
      const result = await queryRunner.query(sql, [BACKFILL_BATCH_SIZE]);
      // node-postgres returns the affected count via the second-element of
      // the result array (`{ affected: number }` in TypeORM ≥0.3); fall back
      // to inspecting `result.length` if the driver returns rows directly.
      const affected =
        Array.isArray(result) && result.length === 2 && typeof result[1] === 'number'
          ? (result[1] as number)
          : Array.isArray(result)
            ? result.length
            : 0;
      if (affected < BACKFILL_BATCH_SIZE) return;
    }
    // If we somehow loop past MAX_BATCHES the data is in an unexpected
    // shape (e.g. a hot insert loop fighting the migration). Bail loudly
    // so the operator notices rather than spinning forever.
    throw new Error(
      `BackfillBenchmarkTier exceeded ${MAX_BATCHES} batches of ${BACKFILL_BATCH_SIZE}; aborting`,
    );
  }
}
