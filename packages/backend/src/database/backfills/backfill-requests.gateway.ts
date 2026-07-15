import { DataSource, QueryRunner } from 'typeorm';
import type { RequestBackfillGateway, RequestBackfillTimeouts } from './backfill-requests';

export const REQUEST_BACKFILL_WINDOW_END_SQL = `
  SELECT max(id) AS end_id
  FROM (
    SELECT id
    FROM "provider_attempts"
    WHERE "request_id" IS NULL AND id > $1
    ORDER BY id
    LIMIT $2
  ) w
`;

const REQUEST_LEVEL_ORIGINS = `'config', 'policy', 'request', 'internal'`;

// These rows predate the explicit request table but never represented a
// provider call. Copy them to requests and remove the pseudo-attempt.
export const INSERT_REJECTIONS_SQL = `
  WITH batch AS (
    SELECT * FROM "provider_attempts"
    WHERE "request_id" IS NULL AND id > $1 AND id <= $2
      AND status <> 'ok'
      AND error_origin IN (${REQUEST_LEVEL_ORIGINS})
  ), ins AS (
    INSERT INTO "requests" (
      id, tenant_id, agent_id, user_id, agent_name, trace_id, session_key, session_id,
      timestamp, duration_ms, status, error_message, error_http_status, error_code,
      error_origin, error_class, requested_model, caller_attribution, request_headers,
      request_params, feedback_rating, feedback_tags, feedback_details
    )
    SELECT
      id, tenant_id, agent_id, user_id, agent_name, trace_id, session_key, session_id,
      timestamp, duration_ms, status, error_message, error_http_status, error_code,
      error_origin, error_class, model, caller_attribution, request_headers,
      request_params, feedback_rating, feedback_tags, feedback_details
    FROM batch
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int AS n FROM ins
`;

export const DELETE_REJECTIONS_SQL = `
  WITH deleted AS (
    DELETE FROM "provider_attempts"
    WHERE "request_id" IS NULL AND id > $1 AND id <= $2
      AND status <> 'ok'
      AND error_origin IN (${REQUEST_LEVEL_ORIGINS})
    RETURNING 1
  )
  SELECT count(*)::int AS n FROM deleted
`;

const LEGACY_REQUEST_ID = `CASE
  WHEN autofix_group_id IS NOT NULL THEN
    'legacy-autofix-' || md5(COALESCE(tenant_id, '') || ':' || COALESCE(agent_id, '') || ':' || autofix_group_id)
  WHEN trace_id IS NOT NULL THEN
    'legacy-trace-' || md5(COALESCE(tenant_id, '') || ':' || COALESCE(agent_id, '') || ':' || trace_id)
  ELSE id
END`;

const OUTCOME_RANK = `CASE
  WHEN status = 'ok' THEN 3
  WHEN NOT COALESCE(superseded, false)
    AND status NOT IN ('fallback_error', 'auto_fixed') THEN 2
  ELSE 1
END`;

export const INSERT_ATTEMPT_REQUESTS_SQL = `
  WITH batch AS (
    SELECT *, ${LEGACY_REQUEST_ID} AS legacy_request_id, ${OUTCOME_RANK} AS outcome_rank
    FROM "provider_attempts"
    WHERE "request_id" IS NULL AND id > $1 AND id <= $2
  ), terminal AS (
    SELECT DISTINCT ON (legacy_request_id) *
    FROM batch
    ORDER BY legacy_request_id, outcome_rank DESC, timestamp DESC, id DESC
  ), ins AS (
    INSERT INTO "requests" (
      id, tenant_id, agent_id, user_id, agent_name, trace_id, session_key, session_id,
      timestamp, duration_ms, status, error_message, error_http_status, error_code,
      error_origin, error_class, requested_model, caller_attribution, request_headers,
      request_params, feedback_rating, feedback_tags, feedback_details
    )
    SELECT
      legacy_request_id, tenant_id, agent_id, user_id, agent_name, trace_id,
      session_key, session_id, timestamp, duration_ms,
      CASE WHEN outcome_rank = 1 THEN 'pending' ELSE status END,
      CASE WHEN outcome_rank = 1 THEN NULL ELSE error_message END,
      CASE WHEN outcome_rank = 1 THEN NULL ELSE error_http_status END,
      CASE WHEN outcome_rank = 1 THEN NULL ELSE error_code END,
      CASE WHEN outcome_rank = 1 THEN NULL ELSE error_origin END,
      CASE WHEN outcome_rank = 1 THEN NULL ELSE error_class END,
      COALESCE(fallback_from_model, model), caller_attribution, request_headers,
      request_params, feedback_rating, feedback_tags, feedback_details
    FROM terminal
    ON CONFLICT (id) DO UPDATE SET
      timestamp = LEAST(requests.timestamp, EXCLUDED.timestamp),
      status = CASE
        WHEN requests.status = 'ok' OR EXCLUDED.status = 'ok' THEN 'ok'
        WHEN EXCLUDED.status = 'pending' THEN requests.status
        ELSE EXCLUDED.status
      END,
      error_message = CASE WHEN requests.status = 'ok' OR EXCLUDED.status = 'pending'
        THEN requests.error_message ELSE EXCLUDED.error_message END,
      error_http_status = CASE WHEN requests.status = 'ok' OR EXCLUDED.status = 'pending'
        THEN requests.error_http_status ELSE EXCLUDED.error_http_status END,
      error_code = CASE WHEN requests.status = 'ok' OR EXCLUDED.status = 'pending'
        THEN requests.error_code ELSE EXCLUDED.error_code END,
      error_origin = CASE WHEN requests.status = 'ok' OR EXCLUDED.status = 'pending'
        THEN requests.error_origin ELSE EXCLUDED.error_origin END,
      error_class = CASE WHEN requests.status = 'ok' OR EXCLUDED.status = 'pending'
        THEN requests.error_class ELSE EXCLUDED.error_class END
    RETURNING (xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE inserted)::int AS n FROM ins
`;

export const LINK_ATTEMPTS_SQL = `
  WITH updated AS (
    UPDATE "provider_attempts"
    SET "request_id" = ${LEGACY_REQUEST_ID}
    WHERE "request_id" IS NULL AND id > $1 AND id <= $2
    RETURNING 1
  )
  SELECT count(*)::int AS n FROM updated
`;

// A legacy request can span UUID-ordered windows. Recompute each affected
// parent from every attempt linked so far, so the final outcome never depends
// on which window happened to contain the success or terminal failure.
export const REFRESH_ATTEMPT_REQUESTS_SQL = `
  WITH affected AS (
    SELECT DISTINCT request_id
    FROM "provider_attempts"
    WHERE id > $1 AND id <= $2 AND request_id IS NOT NULL
  ), totals AS (
    SELECT pa.request_id,
           min(pa.timestamp) AS started_at,
           sum(pa.duration_ms)::int AS duration_ms
    FROM "provider_attempts" pa
    JOIN affected a ON a.request_id = pa.request_id
    GROUP BY pa.request_id
  ), terminal AS (
    SELECT DISTINCT ON (pa.request_id) pa.*
    FROM "provider_attempts" pa
    JOIN affected a ON a.request_id = pa.request_id
    ORDER BY pa.request_id,
      CASE
        WHEN pa.status = 'ok' THEN 3
        WHEN NOT COALESCE(pa.superseded, false)
          AND pa.status NOT IN ('fallback_error', 'auto_fixed') THEN 2
        ELSE 1
      END DESC,
      pa.timestamp DESC,
      pa.id DESC
  )
  UPDATE "requests" r
  SET timestamp = totals.started_at,
      duration_ms = totals.duration_ms,
      status = terminal.status,
      error_message = terminal.error_message,
      error_http_status = terminal.error_http_status,
      error_code = terminal.error_code,
      error_origin = terminal.error_origin,
      error_class = terminal.error_class
  FROM totals
  JOIN terminal ON terminal.request_id = totals.request_id
  WHERE r.id = totals.request_id
`;

export const FINALIZE_PENDING_REQUESTS_SQL = `
  WITH pending AS (
    SELECT r.id
    FROM "requests" r
    WHERE r.status = 'pending'
      AND (
        r.id LIKE 'legacy-autofix-%'
        OR r.id LIKE 'legacy-trace-%'
        OR EXISTS (
          SELECT 1 FROM "provider_attempts" pa
          WHERE pa.request_id = r.id AND pa.id = r.id
        )
      )
  ), last_attempt AS (
    SELECT DISTINCT ON (pa.request_id) pa.*
    FROM "provider_attempts" pa
    JOIN pending p ON p.id = pa.request_id
    ORDER BY pa.request_id, pa.timestamp DESC, pa.id DESC
  )
  UPDATE "requests" r
  SET status = COALESCE(last_attempt.status, 'error'),
      error_message = last_attempt.error_message,
      error_http_status = last_attempt.error_http_status,
      error_code = last_attempt.error_code,
      error_origin = last_attempt.error_origin,
      error_class = last_attempt.error_class
  FROM last_attempt
  WHERE r.id = last_attempt.request_id
`;

export class TypeOrmRequestBackfillGateway implements RequestBackfillGateway {
  constructor(private readonly dataSource: DataSource) {}

  async analyze(): Promise<void> {
    await this.dataSource.query('ANALYZE "provider_attempts"');
  }

  async nextWindowEnd(afterId: string, batchSize: number): Promise<string | null> {
    const rows = (await this.dataSource.query(REQUEST_BACKFILL_WINDOW_END_SQL, [
      afterId,
      batchSize,
    ])) as { end_id: string | null }[];
    return rows[0]?.end_id ?? null;
  }

  async backfillWindow(
    afterId: string,
    endId: string,
    timeouts: RequestBackfillTimeouts,
  ): Promise<{ requests: number; attempts: number; rejections: number }> {
    return this.inTransaction(timeouts, async (runner) => {
      const params = [afterId, endId];
      const [{ n: requests }] = (await runner.query(INSERT_REJECTIONS_SQL, params)) as {
        n: number;
      }[];
      const [{ n: rejections }] = (await runner.query(DELETE_REJECTIONS_SQL, params)) as {
        n: number;
      }[];
      const [{ n: attemptRequests }] = (await runner.query(
        INSERT_ATTEMPT_REQUESTS_SQL,
        params,
      )) as { n: number }[];
      const [{ n: attempts }] = (await runner.query(LINK_ATTEMPTS_SQL, params)) as {
        n: number;
      }[];
      await runner.query(REFRESH_ATTEMPT_REQUESTS_SQL, params);
      return { requests: requests + attemptRequests, attempts, rejections };
    });
  }

  async finalize(timeouts: RequestBackfillTimeouts): Promise<void> {
    await this.inTransaction(timeouts, async (runner) => {
      await runner.query(FINALIZE_PENDING_REQUESTS_SQL);
      // Validation scans the table under SHARE UPDATE EXCLUSIVE: reads and
      // writes continue, unlike adding a validated FK in the deploy migration.
      await runner.query(`SET LOCAL statement_timeout = '0'`);
      await runner.query(
        'ALTER TABLE "provider_attempts" VALIDATE CONSTRAINT "FK_provider_attempts_request"',
      );
    });
  }

  private async inTransaction<T>(
    timeouts: RequestBackfillTimeouts,
    fn: (runner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL lock_timeout = '${timeouts.lockTimeoutMs}ms'`);
      await runner.query(`SET LOCAL statement_timeout = '${timeouts.statementTimeoutMs}ms'`);
      const result = await fn(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
