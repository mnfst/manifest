import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { computeCutoff, sqlDateBucket, sqlHourBucket } from '../../common/utils/postgres-sql';
import { sqlExcludePlayground } from './query-helpers';

/**
 * Request-level volume metrics (mnfst/manifest#2511).
 *
 * Grouping is a lens, not a filter: the Overview's Requests chart must stack
 * to the same total in all three views (By request status / By provider /
 * By harness) and match the headline Requests KPI. That requires counting
 * LOGICAL REQUESTS, each exactly once, attributed to its TERMINAL attempt:
 * the `ok` attempt when one exists, else the last real failure. This mirrors
 * both the Requests list's `picked()` ranking (messages-query.service) and
 * the KPI's request universe (aggregation.getRequestReliability), including
 * zero-attempt rejections (Failed: Setup) and unlinked legacy attempts.
 *
 * Deliberately NOT used by usage/billing surfaces (connection 30d tables,
 * tokens, cost): those answer "what did this provider serve", where the
 * served-only counter remains correct.
 */

/** Same ranking as the Requests list: success wins, else the terminal failure. */
const TERMINAL_RANK = `CASE WHEN pa.status = 'ok' THEN 3
       WHEN NOT COALESCE(pa.superseded, false)
            AND pa.status NOT IN ('fallback_error', 'auto_fixed') THEN 2
       ELSE 1 END`;

/**
 * How the request CONCLUDED, from its terminal attempt. "Healed"/"fallback"
 * mark the method that produced the concluding attempt, never mere attempts
 * along the way — a rescued request counts once, under its rescue method.
 */
const DISPOSITION_EXPR = `CASE
    WHEN t.request_status = 'ok' AND t.autofix_role = 'retry' THEN 'healed'
    WHEN t.request_status = 'ok' AND t.fallback_from_model IS NOT NULL THEN 'fallback'
    WHEN t.request_status = 'ok' THEN 'success'
    ELSE 'error'
  END`;

export interface DispositionRow {
  bucket: string;
  dim: string | null;
  count: string;
}

export interface VolumeSeriesRow {
  [bucketAlias: string]: unknown;
  messages: string | number;
}

export interface DimensionVolumeRow {
  key: string;
  requests: number;
  failed: number;
  succeeded: number;
}

@Injectable()
export class RequestVolumeService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  /**
   * The shared reduction: one row per logical request carrying its terminal
   * attempt's attribution fields. `$1` tenant, `$2` cutoff, `$3` agent name
   * (only when scoped). In-flight requests (`pending`) are excluded — they
   * have no outcome to chart yet.
   */
  private terminalCte(agentName?: string): string {
    const agentPredicateR = agentName
      ? `AND r.agent_id = (
           SELECT id FROM agents
           WHERE tenant_id = $1 AND name = $3 AND deleted_at IS NULL
           LIMIT 1
         )`
      : '';
    const agentPredicatePa = agentName
      ? `AND pa.agent_id = (
           SELECT id FROM agents
           WHERE tenant_id = $1 AND name = $3 AND deleted_at IS NULL
           LIMIT 1
         )`
      : '';
    return `WITH terminal AS (
      (
        SELECT DISTINCT ON (r.id)
          r.id,
          r.timestamp AS ts,
          r.status AS request_status,
          r.agent_name,
          pa.provider,
          pa.model,
          pa.fallback_from_model,
          pa.autofix_role
        FROM requests r
        LEFT JOIN provider_attempts pa ON pa.request_id = r.id
        WHERE r.tenant_id = $1
          AND r.timestamp >= $2
          AND r.status <> 'pending'
          ${agentPredicateR}
          AND ${sqlExcludePlayground('r')}
        ORDER BY r.id,
          ${TERMINAL_RANK} DESC,
          pa.timestamp DESC,
          pa.id DESC
      )
      UNION ALL
      (
        -- Unlinked legacy attempts (pre-backfill): each is its own synthetic
        -- request, matching the KPI's scoped_requests universe.
        SELECT
          pa.id,
          pa.timestamp,
          pa.status,
          pa.agent_name,
          pa.provider,
          pa.model,
          pa.fallback_from_model,
          pa.autofix_role
        FROM provider_attempts pa
        WHERE pa.request_id IS NULL
          AND pa.tenant_id = $1
          AND pa.timestamp >= $2
          ${agentPredicatePa}
          AND ${sqlExcludePlayground('pa')}
      )
    )`;
  }

  private params(tenantId: string, range: string, agentName?: string): unknown[] {
    const cutoff = computeCutoff(rangeToInterval(range));
    return agentName ? [tenantId, cutoff, agentName] : [tenantId, cutoff];
  }

  /**
   * Request-level disposition timeseries: feeds the "By request status" chart
   * and the Healed requests tab. One count per request, keyed by how it
   * concluded (success / healed / fallback / error).
   */
  async getDispositionTimeseries(params: {
    tenantId: string | null;
    range: string;
    hourly: boolean;
    agentName?: string;
    failedOnly?: boolean;
  }): Promise<DispositionRow[]> {
    if (!params.tenantId) return [];
    const bucketExpr = params.hourly ? sqlHourBucket('t.ts') : sqlDateBucket('t.ts');
    const failedFilter = params.failedOnly ? `WHERE ${DISPOSITION_EXPR} = 'error'` : '';
    const sql = `${this.terminalCte(params.agentName)}
      SELECT ${bucketExpr} AS bucket, ${DISPOSITION_EXPR} AS dim, COUNT(*)::int AS count
      FROM terminal t
      ${failedFilter}
      GROUP BY 1, 2
      ORDER BY 1 ASC`;
    return (await this.messageRepo.query(
      sql,
      this.params(params.tenantId, params.range, params.agentName),
    )) as DispositionRow[];
  }

  /**
   * Request volume per provider bucket, attributed to the terminal attempt's
   * provider. Zero-attempt rejections surface as 'No provider' so the series
   * still stack to the request total.
   */
  async getVolumeByProviderTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ): Promise<Array<Record<string, unknown>>> {
    if (!tenantId) return [];
    const bucketExpr = hourly ? sqlHourBucket('t.ts') : sqlDateBucket('t.ts');
    const bucketAlias = hourly ? 'hour' : 'date';
    const sql = `${this.terminalCte(agentName)}
      SELECT ${bucketExpr} AS ${bucketAlias},
        CASE WHEN t.provider LIKE 'custom:%' THEN COALESCE(cp.name, 'Deleted provider')
             WHEN t.provider IS NULL THEN 'No provider'
             ELSE t.provider END AS provider,
        COUNT(*)::int AS messages
      FROM terminal t
      LEFT JOIN custom_providers cp ON t.provider = 'custom:' || cp.id
      GROUP BY 1, 2
      ORDER BY 1 ASC`;
    return (await this.messageRepo.query(sql, this.params(tenantId, range, agentName))) as Array<
      Record<string, unknown>
    >;
  }

  /** Request volume per harness bucket (terminal attribution, requests level). */
  async getVolumeByAgentTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
  ): Promise<Array<Record<string, unknown>>> {
    if (!tenantId) return [];
    const bucketExpr = hourly ? sqlHourBucket('t.ts') : sqlDateBucket('t.ts');
    const bucketAlias = hourly ? 'hour' : 'date';
    const sql = `${this.terminalCte()}
      SELECT ${bucketExpr} AS ${bucketAlias},
        COALESCE(t.agent_name, 'Unknown') AS agent_name,
        COUNT(*)::int AS messages
      FROM terminal t
      GROUP BY 1, 2
      ORDER BY 1 ASC`;
    return (await this.messageRepo.query(sql, this.params(tenantId, range))) as Array<
      Record<string, unknown>
    >;
  }

  /**
   * Request-level totals per dimension for the Overview trio tables
   * (Total requests / Healed / Success rate). `succeeded` counts requests
   * whose terminal outcome is ok (recovered included), so Success rate =
   * succeeded / requests keeps the "success includes rescued" story.
   */
  async getVolumeByDimension(
    dim: 'provider' | 'agent_name' | 'model',
    params: { tenantId: string | null; range?: string; agentName?: string },
  ): Promise<DimensionVolumeRow[]> {
    if (!params.tenantId) return [];
    const range = params.range ?? '7d';
    const keyExpr =
      dim === 'provider'
        ? `CASE WHEN t.provider LIKE 'custom:%' THEN 'custom' ELSE t.provider END`
        : `t.${dim}`;
    const sql = `${this.terminalCte(params.agentName)}
      SELECT ${keyExpr} AS key,
        COUNT(*)::int AS requests,
        COUNT(*) FILTER (WHERE t.request_status <> 'ok')::int AS failed,
        COUNT(*) FILTER (WHERE t.request_status = 'ok')::int AS succeeded
      FROM terminal t
      WHERE ${dim === 'provider' ? 't.provider' : `t.${dim}`} IS NOT NULL
      GROUP BY 1`;
    const rows = (await this.messageRepo.query(
      sql,
      this.params(params.tenantId, range, params.agentName),
    )) as Array<{ key: string; requests: number; failed: number; succeeded: number }>;
    return rows.map((r) => ({
      key: r.key,
      requests: Number(r.requests),
      failed: Number(r.failed),
      succeeded: Number(r.succeeded),
    }));
  }
}
