import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import {
  addTenantFilter,
  selectMessageRowColumns,
  excludePlaygroundAgents,
  scopeToConnection,
  CUSTOM_PROVIDER_JOIN_CONDITION,
  PROVIDER_SERIES_KEY_EXPR,
} from './query-helpers';
import { CustomProvider } from '../../entities/custom-provider.entity';
import {
  computeCutoff,
  sqlHourBucket,
  sqlDateBucket,
  sqlCastFloat,
  sqlSanitizeCost,
} from '../../common/utils/postgres-sql';

interface TimeseriesBucketRow {
  hour?: string;
  date?: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  count: number;
}

export interface PivotedTimeseries {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
}

export interface UsageTimeseries {
  tokenUsage: PivotedTimeseries;
  messageUsage: PivotedTimeseries;
  costUsage: PivotedTimeseries;
}

@Injectable()
export class TimeseriesQueriesService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  async getTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
    authType?: string,
    provider?: string,
    excludePlayground = false,
    label?: string,
    tenantProviderId?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'output_tokens')
      .addSelect(`COALESCE(SUM(${sqlSanitizeCost('at.cost_usd')}), 0)`, 'cost')
      .addSelect('COUNT(*)', 'count')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(qb, tenantId, agentName);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    if (excludePlayground) excludePlaygroundAgents(qb);
    // Scope to this connection: pin to the tenant_providers id when present,
    // else the provider+auth_type+label tuple (see scopeToConnection).
    scopeToConnection(qb, tenantProviderId, label);
    const rows = await qb.groupBy(bucketAlias).orderBy(bucketAlias, 'ASC').getRawMany();

    const tokenUsage: {
      hour?: string;
      date?: string;
      input_tokens: number;
      output_tokens: number;
    }[] = [];
    const costUsage: { hour?: string; date?: string; cost: number }[] = [];
    const messageUsage: { hour?: string; date?: string; count: number }[] = [];

    for (const r of rows) {
      const parsed = this.parseBucketRow(r, bucketAlias);
      const bucketKey = { hour: parsed.hour, date: parsed.date };
      tokenUsage.push({
        ...bucketKey,
        input_tokens: parsed.input_tokens,
        output_tokens: parsed.output_tokens,
      });
      costUsage.push({ ...bucketKey, cost: parsed.cost });
      messageUsage.push({ ...bucketKey, count: parsed.count });
    }

    return { tokenUsage, costUsage, messageUsage };
  }

  async getActiveSkills(
    range: string,
    tenantId: string | null,
    agentName?: string,
    excludePlayground = false,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.skill_name', 'name')
      .addSelect('MIN(at.agent_name)', 'agent_name')
      .addSelect('COUNT(*)', 'run_count')
      .addSelect('MAX(at.timestamp)', 'last_active_at')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.skill_name IS NOT NULL');
    addTenantFilter(qb, tenantId, agentName);
    if (excludePlayground) excludePlaygroundAgents(qb);
    const rows = await qb.groupBy('at.skill_name').orderBy('run_count', 'DESC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      name: String(r['name']),
      agent_name: r['agent_name'] ? String(r['agent_name']) : null,
      run_count: Number(r['run_count'] ?? 0),
      last_active_at: String(r['last_active_at']),
      status: 'active' as const,
    }));
  }

  async getRecentActivity(
    range: string,
    tenantId: string | null,
    limit = 5,
    agentName?: string,
    excludePlayground = false,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);

    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    const qb = selectMessageRowColumns(this.turnRepo.createQueryBuilder('at'), costExpr).where(
      'at.timestamp >= :cutoff',
      { cutoff },
    );
    addTenantFilter(qb, tenantId, agentName);
    if (excludePlayground) excludePlaygroundAgents(qb);
    return qb.orderBy('at.timestamp', 'DESC').limit(limit).getRawMany();
  }

  async getCostByModel(
    range: string,
    tenantId: string | null,
    agentName?: string,
    excludePlayground = false,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select("COALESCE(at.model, 'unknown')", 'model')
      .addSelect('at.model', 'display_name')
      .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
      .addSelect(`COALESCE(SUM(${sqlSanitizeCost('at.cost_usd')}), 0)`, 'estimated_cost')
      .addSelect('at.auth_type', 'auth_type')
      .addSelect('at.provider', 'provider')
      .addSelect('cp.name', 'custom_provider_name')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.model IS NOT NULL')
      .andWhere("at.model != ''");
    addTenantFilter(qb, tenantId, agentName);
    if (excludePlayground) excludePlaygroundAgents(qb);
    const rows = await qb
      .groupBy('at.model')
      .addGroupBy('at.auth_type')
      .addGroupBy('at.provider')
      .addGroupBy('cp.name')
      .orderBy('tokens', 'DESC')
      .getRawMany();

    const totalTokens = rows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + Number(r['tokens'] ?? 0),
      0,
    );
    return rows.map((r: Record<string, unknown>) => ({
      model: String(r['model']),
      display_name: r['display_name'] ? String(r['display_name']) : String(r['model']),
      tokens: Number(r['tokens'] ?? 0),
      share_pct:
        totalTokens === 0 ? 0 : Math.round((Number(r['tokens'] ?? 0) / totalTokens) * 1000) / 10,
      estimated_cost: Number(r['estimated_cost'] ?? 0),
      auth_type: r['auth_type'] ? String(r['auth_type']) : null,
      provider: r['provider'] ? String(r['provider']) : null,
      custom_provider_name: r['custom_provider_name'] ? String(r['custom_provider_name']) : null,
    }));
  }

  async getAgentList(tenantId: string | null, includePlayground = false) {
    // No tenant yet (fresh account) → no agents, by definition.
    if (tenantId === null) return [];

    const agentQb = this.agentRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId });
    agentQb.andWhere('a.deleted_at IS NULL');
    // The reserved Playground agent is a playground agent. Hidden from the
    // Workspace grid / agent switcher by default; the Messages filter opts in
    // via includePlayground so users can filter the log to Playground runs.
    if (!includePlayground) {
      agentQb.andWhere('a.is_playground = false');
    }

    const statsCutoff = computeCutoff('30 days');
    const sparkCutoff = computeCutoff('7 days');
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));
    const dateExpr = sqlDateBucket('at.timestamp');
    // Single per-(agent, day) bucket query keyed by agent_id so soft-deleted
    // agents that share a slug with a live one don't pool their stats.
    // Buckets older than sparkCutoff have zeroed spark_tokens via FILTER.
    const bucketsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.agent_id', 'agent_id')
      .addSelect(dateExpr, 'date')
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status IS NULL OR at.status NOT IN ('error', 'fallback_error'))`,
        'message_count',
      )
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(
        `COALESCE(SUM(at.input_tokens + at.output_tokens) FILTER (WHERE at.timestamp >= :sparkCutoff), 0)`,
        'spark_tokens',
      )
      .addSelect('MAX(at.timestamp)', 'last_active')
      .where('at.agent_id IS NOT NULL')
      .andWhere('at.timestamp >= :statsCutoff', { statsCutoff })
      .setParameter('sparkCutoff', sparkCutoff);
    addTenantFilter(bucketsQb, tenantId);

    const [agents, bucketRows] = await Promise.all([
      agentQb.andWhere('a.is_active = true').orderBy('a.created_at', 'DESC').getMany(),
      bucketsQb
        .groupBy('at.agent_id')
        .addGroupBy('date')
        .orderBy('at.agent_id', 'ASC')
        .addOrderBy('date', 'ASC')
        .getRawMany(),
    ]);

    const sparkCutoffIso = String(sparkCutoff);
    const statsMap = new Map<
      string,
      { message_count: number; total_cost: number; total_tokens: number; last_active: string }
    >();
    const sparkMap = new Map<string, number[]>();
    for (const r of bucketRows) {
      const id = String(r['agent_id']);
      const messageCount = Number(r['message_count'] ?? 0);
      const cost = Number(r['cost'] ?? 0);
      const tokens = Number(r['tokens'] ?? 0);
      const sparkTokens = Number(r['spark_tokens'] ?? 0);
      const rawLastActive = r['last_active'];
      const lastActive =
        rawLastActive instanceof Date ? rawLastActive.toISOString() : String(rawLastActive ?? '');

      const existing = statsMap.get(id);
      if (existing) {
        existing.message_count += messageCount;
        existing.total_cost += cost;
        existing.total_tokens += tokens;
        if (lastActive > existing.last_active) existing.last_active = lastActive;
      } else {
        statsMap.set(id, {
          message_count: messageCount,
          total_cost: cost,
          total_tokens: tokens,
          last_active: lastActive,
        });
      }

      // Sparkline: one entry per day-bucket within the 7-day window. Bucket
      // membership is detected via lastActive (= MAX(timestamp) for that day).
      if (lastActive >= sparkCutoffIso) {
        if (!sparkMap.has(id)) sparkMap.set(id, []);
        sparkMap.get(id)!.push(sparkTokens);
      }
    }

    return agents.map((a) => {
      const stats = statsMap.get(a.id);
      return {
        agent_name: a.name,
        display_name: a.display_name ?? a.name,
        agent_category: a.agent_category ?? null,
        agent_platform: a.agent_platform ?? null,
        message_count: stats?.message_count ?? 0,
        last_active: stats?.last_active || String(a.created_at ?? ''),
        total_cost: stats?.total_cost ?? 0,
        total_tokens: stats?.total_tokens ?? 0,
        sparkline: sparkMap.get(a.id) ?? [],
      };
    });
  }

  async getPerAgentTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    authType?: string,
    provider?: string,
    label?: string,
    tenantProviderId?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.agent_name', 'agent_name')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.agent_name IS NOT NULL');
    // Drop the reserved Playground (is_playground) agent. The NOT EXISTS semi-join
    // matches by id OR name (so name-only Playground rows are excluded too) and
    // can't multiply the per-agent SUM the way a name-based LEFT JOIN would.
    excludePlaygroundAgents(qb);
    addTenantFilter(qb, tenantId);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    // Scope to this connection: pin to the tenant_providers id when present,
    // else the provider+auth_type+label tuple (see scopeToConnection).
    scopeToConnection(qb, tenantProviderId, label);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.agent_name')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'agent_name', 'tokens');
  }

  async getPerAgentMessageTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    authType?: string,
    provider?: string,
    label?: string,
    tenantProviderId?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.agent_name', 'agent_name')
      .addSelect('COUNT(*)', 'messages')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.agent_name IS NOT NULL');
    // Semi-join exclusion (see getPerAgentTimeseries): no double-count, no leak.
    excludePlaygroundAgents(qb);
    addTenantFilter(qb, tenantId);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    // Connection scope (see getPerAgentTimeseries): id when present, else tuple.
    scopeToConnection(qb, tenantProviderId, label);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.agent_name')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'agent_name', 'messages');
  }

  async getPerAgentCostTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    authType?: string,
    provider?: string,
    label?: string,
    tenantProviderId?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.agent_name', 'agent_name')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.agent_name IS NOT NULL');
    // Semi-join exclusion (see getPerAgentTimeseries): no double-count, no leak.
    excludePlaygroundAgents(qb);
    addTenantFilter(qb, tenantId);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    // Connection scope (see getPerAgentTimeseries): id when present, else tuple.
    scopeToConnection(qb, tenantProviderId, label);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.agent_name')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'agent_name', 'cost');
  }

  async getAgentUsageTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    authType?: string,
    provider?: string,
    label?: string,
    tenantProviderId?: string,
  ): Promise<UsageTimeseries> {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.agent_name', 'agent_name')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect('COUNT(*)', 'messages')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.agent_name IS NOT NULL');
    excludePlaygroundAgents(qb);
    addTenantFilter(qb, tenantId);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    scopeToConnection(qb, tenantProviderId, label);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.agent_name')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotUsageRows(rows, bucketAlias, 'agent_name');
  }

  async getPerProviderTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select(bucketExpr, bucketAlias)
      .addSelect(PROVIDER_SERIES_KEY_EXPR, 'provider')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.provider IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent so per-provider totals
    // stay consistent with the per-agent / summary endpoints (semi-join, no leak by id-or-name).
    excludePlaygroundAgents(qb);
    // addTenantFilter also scopes to the LIVE agent owning the slug (id-based),
    // so a soft-deleted agent sharing the name doesn't leak its old rows.
    addTenantFilter(qb, tenantId, agentName);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy(PROVIDER_SERIES_KEY_EXPR)
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'provider', 'tokens');
  }

  async getPerProviderMessageTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select(bucketExpr, bucketAlias)
      .addSelect(PROVIDER_SERIES_KEY_EXPR, 'provider')
      .addSelect('COUNT(*)', 'messages')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.provider IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent (semi-join, no leak by id-or-name).
    excludePlaygroundAgents(qb);
    // addTenantFilter also scopes to the LIVE agent owning the slug (id-based),
    // so a soft-deleted agent sharing the name doesn't leak its old rows.
    addTenantFilter(qb, tenantId, agentName);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy(PROVIDER_SERIES_KEY_EXPR)
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'provider', 'messages');
  }

  async getPerModelTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.model', 'model')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.model IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent so per-model totals stay
    // consistent with the per-agent / summary endpoints (semi-join, no leak by id-or-name).
    excludePlaygroundAgents(qb);
    // addTenantFilter also scopes to the LIVE agent owning the slug (id-based),
    // so a soft-deleted agent sharing the name doesn't leak its old rows.
    addTenantFilter(qb, tenantId, agentName);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.model')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'model', 'tokens');
  }

  async getPerModelMessageTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.model', 'model')
      .addSelect('COUNT(*)', 'messages')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.model IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent (semi-join, no leak by id-or-name).
    excludePlaygroundAgents(qb);
    // addTenantFilter also scopes to the LIVE agent owning the slug (id-based),
    // so a soft-deleted agent sharing the name doesn't leak its old rows.
    addTenantFilter(qb, tenantId, agentName);

    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.model')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();

    return pivotByKey(rows, bucketAlias, 'model', 'messages');
  }

  async getPerProviderCostTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select(bucketExpr, bucketAlias)
      .addSelect(PROVIDER_SERIES_KEY_EXPR, 'provider')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.provider IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent (semi-join, no leak by id-or-name).
    excludePlaygroundAgents(qb);
    // addTenantFilter also scopes to the LIVE agent owning the slug (id-based),
    // so a soft-deleted agent sharing the name doesn't leak its old rows.
    addTenantFilter(qb, tenantId, agentName);
    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy(PROVIDER_SERIES_KEY_EXPR)
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();
    return pivotByKey(rows, bucketAlias, 'provider', 'cost');
  }

  async getProviderUsageTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ): Promise<UsageTimeseries> {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
      .select(bucketExpr, bucketAlias)
      .addSelect(PROVIDER_SERIES_KEY_EXPR, 'provider')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect('COUNT(*)', 'messages')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.provider IS NOT NULL');
    excludePlaygroundAgents(qb);
    addTenantFilter(qb, tenantId, agentName);
    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy(PROVIDER_SERIES_KEY_EXPR)
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();
    return pivotUsageRows(rows, bucketAlias, 'provider');
  }

  async getPerModelCostTimeseries(
    range: string,
    tenantId: string | null,
    hourly: boolean,
    agentName?: string,
  ) {
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);
    const bucketExpr = hourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');
    const bucketAlias = hourly ? 'hour' : 'date';
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.model', 'model')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.model IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent (semi-join, no leak by id-or-name).
    excludePlaygroundAgents(qb);
    // addTenantFilter also scopes to the LIVE agent owning the slug (id-based),
    // so a soft-deleted agent sharing the name doesn't leak its old rows.
    addTenantFilter(qb, tenantId, agentName);
    const rows = await qb
      .groupBy(bucketAlias)
      .addGroupBy('at.model')
      .orderBy(bucketAlias, 'ASC')
      .getRawMany();
    return pivotByKey(rows, bucketAlias, 'model', 'cost');
  }

  async getAgentNamesByAuthType(authType: string, tenantId: string | null): Promise<string[]> {
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select('DISTINCT at.agent_name', 'agent_name')
      .where('at.auth_type = :authType', { authType })
      .andWhere('at.agent_name IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent. The NOT EXISTS semi-join
    // matches by id OR name, so a Playground row carrying only agent_name (NULL
    // agent_id) is still dropped, and it can't multiply rows.
    excludePlaygroundAgents(qb);
    addTenantFilter(qb, tenantId);
    const rows = await qb.orderBy('at.agent_name', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => String(r['agent_name']));
  }

  private parseBucketRow(
    r: Record<string, unknown>,
    bucketAlias: 'hour' | 'date',
  ): TimeseriesBucketRow {
    const row: TimeseriesBucketRow = {
      input_tokens: Number(r['input_tokens'] ?? 0),
      output_tokens: Number(r['output_tokens'] ?? 0),
      cost: Number(r['cost'] ?? 0),
      count: Number(r['count'] ?? 0),
    };
    row[bucketAlias] = String(r[bucketAlias]);
    return row;
  }
}

/**
 * Pivot grouped rows into a per-bucket timeseries with one numeric column per
 * distinct series key. Series keys are sorted alphabetically and every bucket
 * row carries every series (zero-filled), so the frontend can render a stable
 * multi-series chart without re-deriving the column set.
 */
function pivotByKey(
  rows: Array<Record<string, unknown>>,
  bucketAlias: string,
  keyField: string,
  valueField: string,
): { agents: string[]; timeseries: Array<Record<string, number | string>> } {
  const keySet = new Set<string>();
  for (const r of rows) keySet.add(String(r[keyField]));
  const keys = [...keySet].sort();

  const byBucket = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const bucket = String(r[bucketAlias]);
    if (!byBucket.has(bucket)) byBucket.set(bucket, {});
    byBucket.get(bucket)![String(r[keyField])] = Number(r[valueField] ?? 0);
  }

  const timeseries = [...byBucket.entries()].map(([bucket, map]) => {
    const row: Record<string, number | string> = { [bucketAlias]: bucket };
    for (const k of keys) row[k] = map[k] ?? 0;
    return row;
  });

  return { agents: keys, timeseries };
}

function pivotUsageRows(
  rows: Array<Record<string, unknown>>,
  bucketAlias: string,
  keyField: string,
): UsageTimeseries {
  return {
    tokenUsage: pivotByKey(rows, bucketAlias, keyField, 'tokens'),
    messageUsage: pivotByKey(rows, bucketAlias, keyField, 'messages'),
    costUsage: pivotByKey(rows, bucketAlias, keyField, 'cost'),
  };
}
