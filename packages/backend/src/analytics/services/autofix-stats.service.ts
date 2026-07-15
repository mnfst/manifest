import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Tenant } from '../../entities/tenant.entity';
import {
  rangeToInterval,
  rangeToPreviousInterval,
  isHourlyRange,
} from '../../common/utils/range.util';
import { computeCutoff, sqlHourBucket, sqlDateBucket } from '../../common/utils/postgres-sql';
import { addTenantFilter, excludePlaygroundAgents } from './query-helpers';

export interface AutofixStatusResponse {
  /** At least one agent has autofix access (tenant is waitlisted or granted). */
  available: boolean;
  /** At least one agent has autofix explicitly enabled. */
  any_enabled: boolean;
  /** Names of agents with autofix explicitly enabled. */
  enabled_agents: string[];
}

export interface AutofixStatsResponse {
  success_rate: { value: number; previous: number };
  autofix_saves: { value: number; previous: number };
  /** Additive: requests recovered by a successful fallback attempt. */
  fallback_saves: { value: number; previous: number };
  /** Additive: window total, denominator for the self-healed share. */
  total_requests: { value: number; previous: number };
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
  saves: number;
  fallback_saves: number;
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
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
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
      success_rate: { value: rate(current), previous: rate(previous) },
      autofix_saves: { value: current.saves, previous: previous.saves },
      fallback_saves: { value: current.fallback_saves, previous: previous.fallback_saves },
      total_requests: { value: current.total, previous: previous.total },
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
  }): Promise<Array<{ provider: string; requests: number; failed: number; autofixed: number }>> {
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select(
        "CASE WHEN at.provider LIKE 'custom:%' THEN 'custom' ELSE at.provider END",
        'provider',
      )
      .addSelect('COUNT(*)', 'requests')
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status IN ('error','fallback_error','rate_limited','auto_fixed'))`,
        'failed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status = 'auto_fixed' AND at.autofix_group_id IN (
          SELECT sib.autofix_group_id FROM provider_attempts sib
          WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
            AND sib.tenant_id = at.tenant_id
        ))`,
        'autofixed',
      )
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere("(at.autofix_role IS NULL OR at.autofix_role != 'retry')")
      .groupBy("CASE WHEN at.provider LIKE 'custom:%' THEN 'custom' ELSE at.provider END");
    addTenantFilter(qb, params.tenantId, params.agentName);
    excludePlaygroundAgents(qb);

    const rows = await qb.getRawMany<{
      provider: string;
      requests: string;
      failed: string;
      autofixed: string;
    }>();
    return rows.map((r) => ({
      provider: r.provider,
      requests: Number(r.requests),
      failed: Number(r.failed),
      autofixed: Number(r.autofixed),
    }));
  }

  async getPerAgentStats(params: {
    tenantId: string | null;
    range?: string;
  }): Promise<Array<{ agent_name: string; requests: number; failed: number; autofixed: number }>> {
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect('COUNT(*)', 'requests')
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status IN ('error','fallback_error','rate_limited','auto_fixed'))`,
        'failed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status = 'auto_fixed' AND at.autofix_group_id IN (
          SELECT sib.autofix_group_id FROM provider_attempts sib
          WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
            AND sib.tenant_id = at.tenant_id
        ))`,
        'autofixed',
      )
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere("(at.autofix_role IS NULL OR at.autofix_role != 'retry')")
      .groupBy('at.agent_name');
    addTenantFilter(qb, params.tenantId);
    excludePlaygroundAgents(qb);

    const rows = await qb.getRawMany<{
      agent_name: string;
      requests: string;
      failed: string;
      autofixed: string;
    }>();
    return rows.map((r) => ({
      agent_name: r.agent_name,
      requests: Number(r.requests),
      failed: Number(r.failed),
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
    const range = params.range ?? '7d';
    const by = (AUTOFIX_TS_DIMENSIONS as readonly string[]).includes(params.by ?? '')
      ? (params.by as AutofixTsDimension)
      : 'disposition';
    const cutoff = computeCutoff(rangeToInterval(range));
    const hourly = isHourlyRange(range);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const dimExpr = this.dimensionExpr(by);

    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select(bucketExpr, 'bucket')
      .addSelect(dimExpr, 'dim')
      .addSelect('COUNT(*)', 'count')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere("(at.autofix_role IS NULL OR at.autofix_role != 'retry')");

    if (params.failedOnly) {
      qb.andWhere("at.status IN ('error','fallback_error','rate_limited','auto_fixed')");
    }

    qb.groupBy(bucketExpr).addGroupBy(dimExpr).orderBy(bucketExpr, 'ASC');
    addTenantFilter(qb, params.tenantId, params.agentName);
    excludePlaygroundAgents(qb);

    const rows = await qb.getRawMany<{ bucket: string; dim: string | null; count: string }>();
    return this.pivotTimeseries(range, by, rows);
  }

  private dimensionExpr(by: AutofixTsDimension): string {
    switch (by) {
      case 'disposition':
        return `CASE
          WHEN at.status = 'auto_fixed' THEN 'healed'
          WHEN at.status IN ('error','fallback_error','rate_limited') THEN 'error'
          WHEN at.status = 'ok' AND at.fallback_from_model IS NOT NULL THEN 'fallback'
          ELSE 'success' END`;
      case 'http_status':
        return `COALESCE(at.error_http_status::text, 'No response')`;
      case 'provider':
        return `CASE WHEN at.provider LIKE 'custom:%' THEN 'custom' ELSE at.provider END`;
      case 'error_kind':
        return `COALESCE(at.error_class, 'none')`;
      case 'autofix':
        return `CASE WHEN at.autofix_applied = true THEN 'auto-fixed' ELSE 'not fixed' END`;
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
    // For disposition, use a fixed order: success → autofix → fallback → error.
    const DISPOSITION_ORDER: Record<string, number> = {
      success: 0,
      autofix: 1,
      fallback: 2,
      error: 3,
    };
    const keys =
      by === 'disposition'
        ? [...keySet].sort((a, b) => (DISPOSITION_ORDER[a] ?? 99) - (DISPOSITION_ORDER[b] ?? 99))
        : [...keySet].sort();
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
    // Exclude autofix_role='retry' rows so each client request counts once.
    // A healed flow = one 'original' row + one 'retry' row; we count from
    // the original and check if a successful retry sibling exists.
    // Query only total, successes, and saves from SQL.
    // Derive errors = total - successes (guarantees they sum correctly).
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status NOT IN ('error','fallback_error','rate_limited')
          AND (at.status != 'auto_fixed' OR at.autofix_group_id IN (
            SELECT sib.autofix_group_id FROM provider_attempts sib
            WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
              AND sib.tenant_id = at.tenant_id
          )))`,
        'successes',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status = 'auto_fixed' AND at.autofix_group_id IN (
          SELECT sib.autofix_group_id FROM provider_attempts sib
          WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
            AND sib.tenant_id = at.tenant_id
        ))`,
        'saves',
      )
      .addSelect(
        // Additive: a successful fallback attempt = one request recovered by
        // fallback (the failed primary is a separate, superseded row).
        `COUNT(*) FILTER (WHERE at.status = 'ok' AND at.fallback_from_model IS NOT NULL)`,
        'fallback_saves',
      )
      .where('at.timestamp >= :from', { from })
      .andWhere('at.timestamp < :to', { to })
      .andWhere("(at.autofix_role IS NULL OR at.autofix_role != 'retry')");
    addTenantFilter(qb, tenantId, agentName);
    excludePlaygroundAgents(qb);

    const row = await qb.getRawOne<Record<string, string>>();
    const total = Number(row?.total ?? 0);
    const successes = Number(row?.successes ?? 0);
    const saves = Number(row?.saves ?? 0);
    const fallbackSaves = Number(row?.fallback_saves ?? 0);
    const errors = total - successes;
    return {
      total,
      successes,
      saves,
      fallback_saves: fallbackSaves,
      errors,
      healed: saves,
      no_fix_found: errors - saves,
      resolving: 0,
      ineffective: 0,
    };
  }

  private async queryNeedsAttention(
    cutoff: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<AutofixStatsResponse['needs_attention']> {
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select('LEFT(at.error_message, 200)', 'error_message')
      .addSelect('at.provider', 'provider')
      .addSelect('at.model', 'model')
      .addSelect('COUNT(*)', 'count')
      .addSelect("(at.autofix_phoenix->>'issueId')::text", 'phoenix_issue_id')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere("at.status = 'auto_fixed'")
      .andWhere(
        `at.autofix_group_id NOT IN (
          SELECT sib.autofix_group_id FROM provider_attempts sib
          WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
            AND sib.tenant_id = at.tenant_id
        )`,
      )
      .groupBy('LEFT(at.error_message, 200)')
      .addGroupBy('at.provider')
      .addGroupBy('at.model')
      .addGroupBy("(at.autofix_phoenix->>'issueId')::text")
      .orderBy('count', 'DESC')
      .limit(5);
    addTenantFilter(qb, tenantId, agentName);
    excludePlaygroundAgents(qb);

    const rows = await qb.getRawMany<{
      error_message: string | null;
      provider: string;
      model: string;
      count: string;
      phoenix_issue_id: string | null;
    }>();

    return rows.map((r) => ({
      error_message: r.error_message ?? '',
      provider: r.provider,
      model: r.model,
      count: Number(r.count),
      phoenix_issue_id: r.phoenix_issue_id ?? null,
    }));
  }
}
