import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { RequestVolumeService } from './request-volume.service';
import { Agent } from '../../entities/agent.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import {
  addTenantFilter,
  selectMessageRowColumns,
  excludePlaygroundAgents,
  scopeToConnection,
  sqlCountMessages,
  CUSTOM_PROVIDER_JOIN_CONDITION,
  PROVIDER_SERIES_KEY_EXPR,
  sqlExcludePlayground,
} from './query-helpers';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ManifestRequest } from '../../entities/request.entity';
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
    @Optional()
    @InjectRepository(ManifestRequest)
    private readonly requestRepo?: Repository<ManifestRequest>,
    @Optional()
    private readonly requestVolume?: RequestVolumeService,
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
      .addSelect(sqlCountMessages(), 'count')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(qb, tenantId, agentName);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    if (excludePlayground) excludePlaygroundAgents(qb);
    // Scope to this connection: pin to the tenant_providers id when present,
    // else the provider+auth_type+label tuple (see scopeToConnection).
    scopeToConnection(qb, tenantProviderId, label);
    const attemptsPromise = qb.groupBy(bucketAlias).orderBy(bucketAlias, 'ASC').getRawMany();
    const useRequestCounts =
      this.requestRepo && !authType && !provider && !label && !tenantProviderId;
    let requestRowsPromise: Promise<Array<Record<string, unknown>>> = Promise.resolve([]);
    let unlinkedRowsPromise: Promise<Array<Record<string, unknown>>> = Promise.resolve([]);
    if (useRequestCounts) {
      const requestQb = this.requestRepo!.createQueryBuilder('r')
        .select(hourly ? sqlHourBucket('r.timestamp') : sqlDateBucket('r.timestamp'), bucketAlias)
        .addSelect('COUNT(*)', 'count')
        .where('r.timestamp >= :requestCutoff', { requestCutoff: cutoff });
      if (tenantId)
        requestQb.andWhere('r.tenant_id = :requestTenantId', { requestTenantId: tenantId });
      else requestQb.andWhere('1 = 0');
      if (agentName && tenantId) {
        requestQb.andWhere(
          `r.agent_id = (SELECT id FROM agents WHERE tenant_id = :requestTenantId AND name = :requestAgentName AND deleted_at IS NULL LIMIT 1)`,
          { requestAgentName: agentName },
        );
      }
      if (excludePlayground) {
        requestQb.andWhere(sqlExcludePlayground('r'));
      }
      requestRowsPromise = requestQb.groupBy(bucketAlias).orderBy(bucketAlias, 'ASC').getRawMany();

      const unlinkedQb = this.turnRepo
        .createQueryBuilder('at')
        .select(bucketExpr, bucketAlias)
        .addSelect('COUNT(*)', 'count')
        .where('at.request_id IS NULL')
        .andWhere('at.timestamp >= :unlinkedCutoff', { unlinkedCutoff: cutoff });
      addTenantFilter(unlinkedQb, tenantId, agentName);
      if (excludePlayground) excludePlaygroundAgents(unlinkedQb);
      unlinkedRowsPromise = unlinkedQb
        .groupBy(bucketAlias)
        .orderBy(bucketAlias, 'ASC')
        .getRawMany();
    }
    const [rows, requestRows, unlinkedRows] = await Promise.all([
      attemptsPromise,
      requestRowsPromise,
      unlinkedRowsPromise,
    ]);

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

    if (useRequestCounts) {
      const counts = new Map<string, number>();
      for (const row of [...requestRows, ...unlinkedRows]) {
        const value = String(row[bucketAlias] ?? '');
        counts.set(value, (counts.get(value) ?? 0) + Number(row['count'] ?? 0));
      }
      messageUsage.length = 0;
      for (const [bucket, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
        messageUsage.push(hourly ? { hour: bucket, count } : { date: bucket, count });
      }
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
      .addSelect(sqlCountMessages(), 'message_count')
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

    let requestCountRowsPromise: Promise<Array<Record<string, unknown>>> = Promise.resolve([]);
    let unlinkedCountRowsPromise: Promise<Array<Record<string, unknown>>> = Promise.resolve([]);
    if (this.requestRepo) {
      const requestCountsQb = this.requestRepo
        .createQueryBuilder('r')
        .select('r.agent_id', 'agent_id')
        .addSelect('COUNT(*)', 'message_count')
        .addSelect('MAX(r.timestamp)', 'last_active')
        .where('r.agent_id IS NOT NULL')
        .andWhere('r.timestamp >= :requestStatsCutoff', { requestStatsCutoff: statsCutoff });
      requestCountsQb.andWhere('r.tenant_id = :requestTenantId', { requestTenantId: tenantId });
      requestCountRowsPromise = requestCountsQb.groupBy('r.agent_id').getRawMany();

      const unlinkedCountsQb = this.turnRepo
        .createQueryBuilder('at')
        .select('at.agent_id', 'agent_id')
        .addSelect('COUNT(*)', 'message_count')
        .addSelect('MAX(at.timestamp)', 'last_active')
        .where('at.request_id IS NULL')
        .andWhere('at.agent_id IS NOT NULL')
        .andWhere('at.timestamp >= :legacyStatsCutoff', { legacyStatsCutoff: statsCutoff });
      addTenantFilter(unlinkedCountsQb, tenantId);
      unlinkedCountRowsPromise = unlinkedCountsQb.groupBy('at.agent_id').getRawMany();
    }

    const [agents, bucketRows, requestCountRows, unlinkedCountRows] = await Promise.all([
      agentQb.andWhere('a.is_active = true').orderBy('a.created_at', 'DESC').getMany(),
      bucketsQb
        .groupBy('at.agent_id')
        .addGroupBy('date')
        .orderBy('at.agent_id', 'ASC')
        .addOrderBy('date', 'ASC')
        .getRawMany(),
      requestCountRowsPromise,
      unlinkedCountRowsPromise,
    ]);

    const sparkCutoffIso = String(sparkCutoff);
    const statsMap = new Map<
      string,
      { message_count: number; total_cost: number; total_tokens: number; last_active: string }
    >();
    const requestStatsMap = new Map<string, { count: number; last_active: string }>();
    for (const r of [...requestCountRows, ...unlinkedCountRows]) {
      const id = String(r['agent_id']);
      const rawLastActive = r['last_active'];
      const lastActive =
        rawLastActive instanceof Date ? rawLastActive.toISOString() : String(rawLastActive ?? '');
      const existing = requestStatsMap.get(id);
      if (existing) {
        existing.count += Number(r['message_count'] ?? 0);
        if (lastActive > existing.last_active) existing.last_active = lastActive;
      } else {
        requestStatsMap.set(id, {
          count: Number(r['message_count'] ?? 0),
          last_active: lastActive,
        });
      }
    }
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
      const requestStats = requestStatsMap.get(a.id);
      return {
        agent_name: a.name,
        display_name: a.display_name ?? a.name,
        agent_category: a.agent_category ?? null,
        agent_platform: a.agent_platform ?? null,
        message_count: requestStats?.count ?? stats?.message_count ?? 0,
        last_active:
          [requestStats?.last_active, stats?.last_active].filter(Boolean).sort().at(-1) ||
          String(a.created_at ?? ''),
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

    const useRequestCounts =
      this.requestRepo && !authType && !provider && !label && !tenantProviderId;
    if (useRequestCounts) {
      const requestBucketExpr = hourly
        ? sqlHourBucket('r.timestamp')
        : sqlDateBucket('r.timestamp');
      const requestQb = this.requestRepo!.createQueryBuilder('r')
        .select(requestBucketExpr, bucketAlias)
        .addSelect('r.agent_name', 'agent_name')
        .addSelect('COUNT(*)', 'messages')
        .where('r.timestamp >= :requestCutoff', { requestCutoff: cutoff })
        .andWhere('r.agent_name IS NOT NULL')
        .andWhere(sqlExcludePlayground('r'));
      if (tenantId)
        requestQb.andWhere('r.tenant_id = :requestTenantId', { requestTenantId: tenantId });
      else requestQb.andWhere('1 = 0');

      const unlinkedQb = this.turnRepo
        .createQueryBuilder('at')
        .select(bucketExpr, bucketAlias)
        .addSelect('at.agent_name', 'agent_name')
        .addSelect('COUNT(*)', 'messages')
        .where('at.request_id IS NULL')
        .andWhere('at.timestamp >= :unlinkedCutoff', { unlinkedCutoff: cutoff })
        .andWhere('at.agent_name IS NOT NULL');
      addTenantFilter(unlinkedQb, tenantId);
      excludePlaygroundAgents(unlinkedQb);

      const [requestRows, unlinkedRows] = await Promise.all([
        requestQb
          .groupBy(bucketAlias)
          .addGroupBy('r.agent_name')
          .orderBy(bucketAlias, 'ASC')
          .getRawMany(),
        unlinkedQb
          .groupBy(bucketAlias)
          .addGroupBy('at.agent_name')
          .orderBy(bucketAlias, 'ASC')
          .getRawMany(),
      ]);
      const combined = new Map<string, Record<string, unknown>>();
      for (const row of [...requestRows, ...unlinkedRows]) {
        const key = `${String(row[bucketAlias])}\0${String(row['agent_name'])}`;
        const current = combined.get(key);
        if (current) current['messages'] = Number(current['messages']) + Number(row['messages']);
        else combined.set(key, { ...row, messages: Number(row['messages'] ?? 0) });
      }
      const rows = [...combined.values()].sort((a, b) =>
        String(a[bucketAlias]).localeCompare(String(b[bucketAlias])),
      );
      return pivotByKey(rows, bucketAlias, 'agent_name', 'messages');
    }

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select(bucketExpr, bucketAlias)
      .addSelect('at.agent_name', 'agent_name')
      .addSelect(sqlCountMessages(), 'messages')
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
      .addSelect(sqlCountMessages(), 'messages')
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

    const usage = pivotUsageRows(rows, bucketAlias, 'agent_name');
    // #2511: same request-level Requests series as the by-provider view, but
    // ONLY for the unscoped Overview chart. Connection-scoped calls (authType/
    // provider/label/tenantProviderId) are usage surfaces: served-only stays.
    const scoped = authType || provider || label || tenantProviderId;
    if (this.requestVolume && !scoped) {
      const volumeRows = await this.requestVolume.getVolumeByAgentTimeseries(
        range,
        tenantId,
        hourly,
      );
      usage.messageUsage = pivotByKey(volumeRows, bucketAlias, 'agent_name', 'messages');
    }
    return usage;
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
      .addSelect(sqlCountMessages(), 'messages')
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
      .addSelect(sqlCountMessages(), 'messages')
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
      .addSelect(sqlCountMessages(), 'messages')
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
    const usage = pivotUsageRows(rows, bucketAlias, 'provider');
    // #2511: the Requests series counts logical requests (terminal-attempt
    // attribution, failures included) so the by-provider view stacks to the
    // same total as By request status and the Requests KPI. Tokens and cost
    // keep summing every attempt: you pay for what burned.
    if (this.requestVolume) {
      const volumeRows = await this.requestVolume.getVolumeByProviderTimeseries(
        range,
        tenantId,
        hourly,
        agentName,
      );
      usage.messageUsage = pivotByKey(volumeRows, bucketAlias, 'provider', 'messages');
    }
    return usage;
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
