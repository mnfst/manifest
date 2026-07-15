import { DataSource } from 'typeorm';

import { BackfillGateway, BackfillTimeouts } from './backfill-message-providers';

/**
 * Next keyset window upper bound: the largest id among the next `batchSize`
 * ids strictly greater than `afterId`. Walks the PK index, never OFFSET.
 */
export const WINDOW_END_SQL = `
  SELECT max(id) AS end_id
  FROM (
    SELECT id FROM "provider_attempts" WHERE id > $1 ORDER BY id LIMIT $2
  ) w
`;

/**
 * The three stamping passes — identical matching logic to the original
 * in-migration backfill, translated to the post-rename schema
 * (tenant_provider_id / tenant_providers / created_by_user_id) and with ONLY
 * the keyset window `am2.id > $1 AND am2.id <= $2` added. Wrapped in a CTE so
 * each returns how many rows it stamped without shipping every updated row.
 */
function stampingPass(joinAndMatch: string): string {
  return `
    WITH upd AS (
      UPDATE "provider_attempts" am
      SET "tenant_provider_id" = m.tp_id
      FROM (
        SELECT am2.id AS msg_id, MIN(tp.id) AS tp_id
        ${joinAndMatch}
        GROUP BY am2.id
        HAVING COUNT(*) = 1
      ) m
      WHERE am.id = m.msg_id
      RETURNING 1
    )
    SELECT count(*)::int AS n FROM upd
  `;
}

// Pass 1 (agent-exact): agent_id + provider + auth_type + label.
export const PASS_1_SQL = stampingPass(`
  FROM "provider_attempts" am2
  JOIN "tenant_providers" tp
    ON tp.agent_id = am2.agent_id
   AND LOWER(tp.provider) = LOWER(am2.provider)
   AND tp.auth_type = am2.auth_type
   AND LOWER(tp.label) = LOWER(COALESCE(am2.provider_key_label, 'Default'))
  WHERE am2.tenant_provider_id IS NULL
    AND am2.provider IS NOT NULL
    AND am2.agent_id IS NOT NULL
    AND am2.id > $1 AND am2.id <= $2
`);

// Pass 2 (agent-unique): same agent anchor, ignore label.
export const PASS_2_SQL = stampingPass(`
  FROM "provider_attempts" am2
  JOIN "tenant_providers" tp
    ON tp.agent_id = am2.agent_id
   AND LOWER(tp.provider) = LOWER(am2.provider)
   AND tp.auth_type = am2.auth_type
  WHERE am2.tenant_provider_id IS NULL
    AND am2.provider IS NOT NULL
    AND am2.agent_id IS NOT NULL
    AND am2.id > $1 AND am2.id <= $2
`);

// Pass 3 (user-level): match via tenants.name = tenant_providers.created_by_user_id
// (created_by_user_id is the renamed, value-preserved user_id).
export const PASS_3_SQL = stampingPass(`
  FROM "provider_attempts" am2
  JOIN "tenants" t ON t.id = am2.tenant_id
  JOIN "tenant_providers" tp
    ON tp.created_by_user_id = t.name
   AND LOWER(tp.provider) = LOWER(am2.provider)
   AND tp.auth_type = am2.auth_type
   AND LOWER(tp.label) = LOWER(COALESCE(am2.provider_key_label, 'Default'))
  WHERE am2.tenant_provider_id IS NULL
    AND am2.provider IS NOT NULL
    AND am2.id > $1 AND am2.id <= $2
`);

/** DataSource-backed gateway. The orchestrator stays database-agnostic. */
export class TypeOrmBackfillGateway implements BackfillGateway {
  constructor(private readonly dataSource: DataSource) {}

  async analyze(): Promise<void> {
    // Refresh stats for the stamping passes: provider_attempts (its
    // tenant_provider_id column was just added and is ~100% NULL) and the
    // tenant_providers join target.
    await this.dataSource.query('ANALYZE "provider_attempts"');
    await this.dataSource.query('ANALYZE "tenant_providers"');
  }

  async nextWindowEnd(afterId: string, batchSize: number): Promise<string | null> {
    const rows = (await this.dataSource.query(WINDOW_END_SQL, [afterId, batchSize])) as {
      end_id: string | null;
    }[];
    return rows[0]?.end_id ?? null;
  }

  async stampWindow(afterId: string, endId: string, timeouts: BackfillTimeouts): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // SET LOCAL is transaction-scoped and PgBouncer-transaction-pool safe.
      await queryRunner.query(`SET LOCAL lock_timeout = '${timeouts.lockTimeoutMs}ms'`);
      await queryRunner.query(`SET LOCAL statement_timeout = '${timeouts.statementTimeoutMs}ms'`);
      const params = [afterId, endId];
      const [{ n: n1 }] = (await queryRunner.query(PASS_1_SQL, params)) as { n: number }[];
      const [{ n: n2 }] = (await queryRunner.query(PASS_2_SQL, params)) as { n: number }[];
      const [{ n: n3 }] = (await queryRunner.query(PASS_3_SQL, params)) as { n: number }[];
      await queryRunner.commitTransaction();
      return n1 + n2 + n3;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
