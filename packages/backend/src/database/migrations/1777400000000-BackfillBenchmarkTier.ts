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
 */
export class BackfillBenchmarkTier1777400000000 implements MigrationInterface {
  name = 'BackfillBenchmarkTier1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agent_messages"
       SET "routing_tier" = 'benchmark',
           "routing_reason" = NULL
       WHERE "routing_reason" = 'benchmark'
         AND "routing_tier" IS NULL`,
    );
  }

  /**
   * Caveat: this revert re-tags every `routing_tier='benchmark'` row —
   * including any rows that were always correct under the new scheme
   * (rows written by the flipped `BenchmarkService` after deployment).
   * We can't tell "originally-backfilled" and "originally-correct" apart
   * because both look identical post-up(), so a down() treats them the
   * same. Acceptable because (a) benchmark rows are ephemeral side-by-side
   * experiments, and (b) we only ever call down() in local dev or CI.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agent_messages"
       SET "routing_tier" = NULL,
           "routing_reason" = 'benchmark'
       WHERE "routing_tier" = 'benchmark'
         AND "routing_reason" IS NULL`,
    );
  }
}
