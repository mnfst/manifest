import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ManifestRequest } from '../../entities/request.entity';
import { Tenant } from '../../entities/tenant.entity';
import {
  rangeToInterval,
  rangeToPreviousInterval,
  isHourlyRange,
} from '../../common/utils/range.util';
import { computeCutoff, sqlHourBucket, sqlDateBucket } from '../../common/utils/postgres-sql';

export interface AutofixStatusResponse {
  /** At least one agent has autofix access (tenant is waitlisted or granted). */
  available: boolean;
  /** At least one agent has autofix explicitly enabled. */
  any_enabled: boolean;
  /** Names of agents with autofix explicitly enabled. */
  enabled_agents: string[];
}

export interface AutofixStatsResponse {
  total_requests: { value: number; previous: number };
  /** Request-level success rate: requests that ended OK for the caller (incl. recovered). */
  success_rate: { value: number; previous: number };
  /** Requests recovered by Manifest (autofix or fallback — first attempt failed, request succeeded). */
  recovered_by_manifest: { value: number; previous: number };
  /** Requests that ultimately failed (caller got an error). */
  errors_remaining: { value: number; previous: number };
  coverage: { rate: number; previous_rate: number };
  dispositions: {
    healed: number;
    no_fix_found: number;
    resolving: number;
    ineffective: number;
  };
  needs_attention: Array<{
    error_message: string;
    provider: string;
    model: string;
    count: number;
    phoenix_issue_id: string | null;
  }>;
}

export const AUTOFIX_TS_DIMENSIONS = [
  'disposition',
  'recovery',
  'http_status',
  'provider',
  'error_kind',
  'autofix',
] as const;
export type AutofixTsDimension = (typeof AUTOFIX_TS_DIMENSIONS)[number];

export interface AutofixTimeseriesResponse {
  range: string;
  by: string;
  keys: string[];
  buckets: Array<{ bucket: string; counts: number[] }>;
}

interface WindowCounts {
  total: number;
  successes: number;
  recovered: number;
  errors: number;
  healed: number;
  no_fix_found: number;
  resolving: number;
  ineffective: number;
}

@Injectable()
export class AutofixStatsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(ManifestRequest)
    private readonly requestRepo: Repository<ManifestRequest>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  async getWorkspaceStatus(tenantId: string | null): Promise<AutofixStatusResponse> {
    if (!tenantId) {
      return { available: false, any_enabled: false, enabled_agents: [] };
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const available =
      !!tenant &&
      (tenant.autofix_access_granted_at !== null || tenant.autofix_waitlist_at !== null);

    if (!available) {
      return { available: false, any_enabled: false, enabled_agents: [] };
    }

    const agents = await this.agentRepo.find({
      where: { tenant_id: tenantId, autofix_enabled: true, deleted_at: IsNull() },
      select: ['name'],
    });

    return {
      available: true,
      any_enabled: agents.length > 0,
      enabled_agents: agents.map((a) => a.name),
    };
  }

  async getStats(params: {
    tenantId: string | null;
    range?: string;
    agentName?: string;
  }): Promise<AutofixStatsResponse> {
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));
    const prevCutoff = computeCutoff(rangeToPreviousInterval(range));

    const [current, previous, attention] = await Promise.all([
      this.queryWindow(cutoff, computeCutoff('0 hours'), params.tenantId, params.agentName),
      this.queryWindow(prevCutoff, cutoff, params.tenantId, params.agentName),
      this.queryNeedsAttention(cutoff, params.tenantId, params.agentName),
    ]);

    const rate = (c: WindowCounts) => (c.total > 0 ? c.successes / c.total : 0);
    const afxTotal = (c: WindowCounts) => c.healed + c.no_fix_found + c.resolving + c.ineffective;
    const covRate = (c: WindowCounts) => {
      const d = afxTotal(c);
      return d > 0 ? c.healed / d : 0;
    };

    return {
      total_requests: { value: current.total, previous: previous.total },
      success_rate: { value: rate(current), previous: rate(previous) },
      recovered_by_manifest: { value: current.recovered, previous: previous.recovered },
      errors_remaining: { value: current.errors, previous: previous.errors },
      coverage: { rate: covRate(current), previous_rate: covRate(previous) },
      dispositions: {
        healed: current.healed,
        no_fix_found: current.no_fix_found,
        resolving: current.resolving,
        ineffective: current.ineffective,
      },
      needs_attention: attention,
    };
  }

  async getPerProviderStats(params: {
    tenantId: string | null;
    range?: string;
    agentName?: string;
  }): Promise<Array<{ provider: string; requests: number; autofixed: number }>> {
    if (!params.tenantId) return [];
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));

    // Per-provider stats from the request level: join the "winning" attempt
    // (the last ok attempt, or the last attempt if the request failed) to get
    // the provider that served each request.
    const agentFilter = params.agentName
      ? `AND r.agent_id = (
            SELECT a.id FROM agents a
            WHERE a.tenant_id = $1 AND a.name = $3 AND a.deleted_at IS NULL LIMIT 1
          )`
      : '';
    const cutoffIdx = params.agentName ? '$2' : '$2';
    const sql = `
      WITH winning AS (
        SELECT DISTINCT ON (pa.request_id)
          pa.request_id,
          CASE WHEN pa.provider LIKE 'custom:%' THEN 'custom' ELSE pa.provider END AS provider
        FROM provider_attempts pa
        JOIN requests r ON r.id = pa.request_id
        WHERE r.tenant_id = $1
          AND r.timestamp >= ${cutoffIdx}
          ${agentFilter}
        ORDER BY pa.request_id, pa.status = 'ok' DESC, pa.timestamp DESC
      )
      SELECT
        w.provider,
        COUNT(*)::int AS requests,
        COUNT(*) FILTER (WHERE r.status = 'ok' AND (
          SELECT COUNT(*) FROM provider_attempts pa2 WHERE pa2.request_id = r.id
        ) > 1)::int AS autofixed
      FROM requests r
      JOIN winning w ON w.request_id = r.id
      WHERE r.tenant_id = $1
        AND r.timestamp >= ${cutoffIdx}
        ${agentFilter}
        AND NOT EXISTS (
          SELECT 1 FROM agents playag
          WHERE playag.tenant_id = r.tenant_id AND playag.is_playground = true
            AND (playag.id = r.agent_id OR playag.name = r.agent_name)
        )
      GROUP BY w.provider
    `;
    const queryParams: unknown[] = [
      params.tenantId,
      cutoff,
      ...(params.agentName ? [params.agentName] : []),
    ];
    const rows = await this.dataSource.query(sql, queryParams);
    return (rows as any[]).map((r) => ({
      provider: r.provider,
      requests: Number(r.requests),
      autofixed: Number(r.autofixed),
    }));
  }

  async getPerAgentStats(params: {
    tenantId: string | null;
    range?: string;
  }): Promise<Array<{ agent_name: string; requests: number; autofixed: number }>> {
    if (!params.tenantId) return [];
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));

    const sql = `
      SELECT
        r.agent_name,
        COUNT(*)::int AS requests,
        COUNT(*) FILTER (WHERE r.status = 'ok' AND (
          SELECT COUNT(*) FROM provider_attempts pa WHERE pa.request_id = r.id
        ) > 1)::int AS autofixed
      FROM requests r
      WHERE r.tenant_id = $1
        AND r.timestamp >= $2
        AND NOT EXISTS (
          SELECT 1 FROM agents playag
          WHERE playag.tenant_id = r.tenant_id AND playag.is_playground = true
            AND (playag.id = r.agent_id OR playag.name = r.agent_name)
        )
      GROUP BY r.agent_name
    `;
    const rows = await this.dataSource.query(sql, [params.tenantId, cutoff]);
    return (rows as any[]).map((r) => ({
      agent_name: r.agent_name,
      requests: Number(r.requests),
      autofixed: Number(r.autofixed),
    }));
  }

  async getTimeseries(params: {
    tenantId: string | null;
    range?: string;
    by?: string;
    agentName?: string;
    failedOnly?: boolean;
  }): Promise<AutofixTimeseriesResponse> {
    if (!params.tenantId)
      return { range: params.range ?? '7d', by: 'disposition', keys: [], buckets: [] };
    const range = params.range ?? '7d';
    const by = (AUTOFIX_TS_DIMENSIONS as readonly string[]).includes(params.by ?? '')
      ? (params.by as AutofixTsDimension)
      : 'disposition';
    const cutoff = computeCutoff(rangeToInterval(range));
    const hourly = isHourlyRange(range);
    const bucketExpr = hourly ? sqlHourBucket('r.timestamp') : sqlDateBucket('r.timestamp');
    const dimExpr = this.requestDimensionExpr(by);

    const agentFilter = params.agentName
      ? `AND r.agent_id = (
            SELECT a.id FROM agents a
            WHERE a.tenant_id = $1 AND a.name = $3 AND a.deleted_at IS NULL LIMIT 1
          )`
      : '';
    const failedFilter = params.failedOnly ? `AND r.status != 'ok'` : '';
    const playgroundExclude = `AND NOT EXISTS (
      SELECT 1 FROM agents playag
      WHERE playag.tenant_id = r.tenant_id AND playag.is_playground = true
        AND (playag.id = r.agent_id OR playag.name = r.agent_name)
    )`;

    const sql = `
      SELECT ${bucketExpr} AS bucket, ${dimExpr} AS dim, COUNT(*)::int AS count
      FROM requests r
      WHERE r.tenant_id = $1
        AND r.timestamp >= $2
        ${agentFilter}
        ${failedFilter}
        ${playgroundExclude}
      GROUP BY bucket, dim
      ORDER BY bucket ASC
    `;
    const queryParams: unknown[] = [
      params.tenantId,
      cutoff,
      ...(params.agentName ? [params.agentName] : []),
    ];
    const rows = (await this.dataSource.query(sql, queryParams)) as Array<{
      bucket: string;
      dim: string | null;
      count: string;
    }>;
    return this.pivotTimeseries(range, by, rows);
  }

  private requestDimensionExpr(by: AutofixTsDimension): string {
    switch (by) {
      case 'disposition':
        return `CASE WHEN r.status = 'ok' THEN 'success' ELSE 'error' END`;
      case 'recovery':
        // Subdivide successes by recovery path, keep errors as one bucket.
        // A request is "recovered" when it succeeded but needed >1 attempt.
        // We distinguish fallback vs autofix by checking if any attempt has
        // autofix_applied=true (autofix path) or fallback_from_model set (fallback path).
        return `CASE
          WHEN r.status != 'ok' THEN 'error'
          WHEN (SELECT COUNT(*) FROM provider_attempts pa WHERE pa.request_id = r.id) <= 1 THEN 'direct'
          WHEN EXISTS (
            SELECT 1 FROM provider_attempts pa
            WHERE pa.request_id = r.id AND pa.autofix_applied = true
          ) THEN 'autofix'
          WHEN EXISTS (
            SELECT 1 FROM provider_attempts pa
            WHERE pa.request_id = r.id AND pa.fallback_from_model IS NOT NULL
          ) THEN 'fallback'
          ELSE 'direct'
        END`;
      case 'http_status':
        return `COALESCE(r.error_http_status::text, CASE WHEN r.status = 'ok' THEN '200' ELSE 'No response' END)`;
      case 'provider':
        return `COALESCE((
          SELECT CASE WHEN pa.provider LIKE 'custom:%' THEN 'custom' ELSE pa.provider END
          FROM provider_attempts pa WHERE pa.request_id = r.id
          ORDER BY pa.status = 'ok' DESC, pa.timestamp DESC LIMIT 1
        ), 'unknown')`;
      case 'error_kind':
        return `COALESCE(r.error_class, 'none')`;
      case 'autofix':
        return `CASE WHEN r.status = 'ok' AND (
          SELECT COUNT(*) FROM provider_attempts pa WHERE pa.request_id = r.id
        ) > 1 THEN 'recovered' ELSE 'direct' END`;
    }
  }

  private pivotTimeseries(
    range: string,
    by: string,
    rows: Array<{ bucket: string; dim: string | null; count: string }>,
  ): AutofixTimeseriesResponse {
    const keySet = new Set<string>();
    const bucketMap = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const dim = r.dim ?? 'unknown';
      keySet.add(dim);
      let m = bucketMap.get(r.bucket);
      if (!m) {
        m = new Map();
        bucketMap.set(r.bucket, m);
      }
      m.set(dim, (m.get(dim) ?? 0) + Number(r.count));
    }
    const keys = [...keySet].sort();
    const buckets = [...bucketMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, m]) => ({
        bucket,
        counts: keys.map((k) => m.get(k) ?? 0),
      }));
    return { range, by, keys, buckets };
  }

  private async queryWindow(
    from: string,
    to: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<WindowCounts> {
    // Request-centric: query from the requests table directly.
    // A request is "recovered by Manifest" when it succeeded (status='ok')
    // but needed more than one provider attempt (fallback or autofix).
    if (tenantId === null) {
      return {
        total: 0,
        successes: 0,
        recovered: 0,
        errors: 0,
        healed: 0,
        no_fix_found: 0,
        resolving: 0,
        ineffective: 0,
      };
    }

    const agentFilter = agentName
      ? `AND r.agent_id = (
            SELECT a.id FROM agents a
            WHERE a.tenant_id = $1
              AND a.name = $3
              AND a.deleted_at IS NULL
            LIMIT 1
          )`
      : '';
    const playgroundExclude = `AND NOT EXISTS (
      SELECT 1 FROM agents playag
      WHERE playag.tenant_id = r.tenant_id
        AND playag.is_playground = true
        AND (playag.id = r.agent_id OR playag.name = r.agent_name)
    )`;

    const params: unknown[] = [tenantId, from, ...(agentName ? [agentName] : []), to];
    const toIdx = agentName ? '$4' : '$3';

    const sql = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE r.status = 'ok')::int AS successes,
        COUNT(*) FILTER (WHERE r.status = 'ok' AND (
          SELECT COUNT(*) FROM provider_attempts pa WHERE pa.request_id = r.id
        ) > 1)::int AS recovered
      FROM requests r
      WHERE r.tenant_id = $1
        AND r.timestamp >= $2
        AND r.timestamp < ${toIdx}
        ${agentFilter}
        ${playgroundExclude}
    `;

    const rows = await this.dataSource.query(sql, params);
    const row = rows[0] ?? {};
    const total = Number(row.total ?? 0);
    const successes = Number(row.successes ?? 0);
    const recovered = Number(row.recovered ?? 0);
    const errors = total - successes;
    return {
      total,
      successes,
      recovered,
      errors,
      healed: recovered,
      no_fix_found: errors,
      resolving: 0,
      ineffective: 0,
    };
  }

  private async queryNeedsAttention(
    cutoff: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<AutofixStatsResponse['needs_attention']> {
    if (!tenantId) return [];
    // Request-level: show requests that ultimately failed for the caller
    const agentFilter = agentName
      ? `AND r.agent_id = (
            SELECT a.id FROM agents a
            WHERE a.tenant_id = $1 AND a.name = $3 AND a.deleted_at IS NULL LIMIT 1
          )`
      : '';
    const sql = `
      SELECT
        LEFT(r.error_message, 200) AS error_message,
        COALESCE((
          SELECT CASE WHEN pa.provider LIKE 'custom:%' THEN 'custom' ELSE pa.provider END
          FROM provider_attempts pa WHERE pa.request_id = r.id
          ORDER BY pa.timestamp DESC LIMIT 1
        ), 'unknown') AS provider,
        COALESCE(r.requested_model, 'unknown') AS model,
        COUNT(*)::int AS count,
        NULL::text AS phoenix_issue_id
      FROM requests r
      WHERE r.tenant_id = $1
        AND r.timestamp >= $2
        AND r.status != 'ok'
        ${agentFilter}
        AND NOT EXISTS (
          SELECT 1 FROM agents playag
          WHERE playag.tenant_id = r.tenant_id AND playag.is_playground = true
            AND (playag.id = r.agent_id OR playag.name = r.agent_name)
        )
      GROUP BY LEFT(r.error_message, 200), provider, model
      ORDER BY count DESC
      LIMIT 5
    `;
    const params: unknown[] = [tenantId, cutoff, ...(agentName ? [agentName] : [])];
    const rows = (await this.dataSource.query(sql, params)) as any[];
    return rows.map((r) => ({
      error_message: r.error_message ?? '',
      provider: r.provider,
      model: r.model,
      count: Number(r.count),
      phoenix_issue_id: r.phoenix_issue_id ?? null,
    }));
  }
}
