import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { addTenantFilter, selectMessageRowColumns } from './query-helpers';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
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

@Injectable()
export class TimeseriesQueriesService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async getTimeseries(
    range: string,
    userId: string,
    hourly: boolean,
    tenantId?: string,
    agentName?: string,
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
    addTenantFilter(qb, userId, agentName, tenantId);
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

  async getActiveSkills(range: string, userId: string, agentName?: string, tenantId?: string) {
    const resolved = tenantId ?? (await this.tenantCache.resolve(userId)) ?? undefined;
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
    addTenantFilter(qb, userId, agentName, resolved);
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
    userId: string,
    limit = 5,
    agentName?: string,
    tenantId?: string,
  ) {
    const resolved = tenantId ?? (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);

    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    const qb = selectMessageRowColumns(this.turnRepo.createQueryBuilder('at'), costExpr).where(
      'at.timestamp >= :cutoff',
      { cutoff },
    );
    addTenantFilter(qb, userId, agentName, resolved);
    return qb.orderBy('at.timestamp', 'DESC').limit(limit).getRawMany();
  }

  async getCostByModel(range: string, userId: string, agentName?: string, tenantId?: string) {
    const resolved = tenantId ?? (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const cutoff = computeCutoff(interval);

    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("COALESCE(at.model, 'unknown')", 'model')
      .addSelect('at.model', 'display_name')
      .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
      .addSelect(`COALESCE(SUM(${sqlSanitizeCost('at.cost_usd')}), 0)`, 'estimated_cost')
      .addSelect('at.auth_type', 'auth_type')
      .addSelect('at.provider', 'provider')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.model IS NOT NULL')
      .andWhere("at.model != ''");
    addTenantFilter(qb, userId, agentName, resolved);
    const rows = await qb
      .groupBy('at.model')
      .addGroupBy('at.auth_type')
      .addGroupBy('at.provider')
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
    }));
  }

  async getAgentList(userId: string, tenantId?: string) {
    const resolved = tenantId ?? (await this.tenantCache.resolve(userId)) ?? undefined;

    const agentQb = this.agentRepo.createQueryBuilder('a');
    if (resolved) {
      agentQb.where('a.tenant_id = :tenantId', { tenantId: resolved });
    } else {
      agentQb.leftJoin('a.tenant', 't').where('t.name = :userId', { userId });
    }
    agentQb.andWhere('a.deleted_at IS NULL');

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
    addTenantFilter(bucketsQb, userId, undefined, resolved);

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
