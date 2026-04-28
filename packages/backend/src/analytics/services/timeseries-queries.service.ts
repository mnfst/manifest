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

    const statsCutoff = computeCutoff('30 days');
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));
    const statsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect(
        `COUNT(*) FILTER (WHERE at.status IS NULL OR at.status NOT IN ('error', 'fallback_error'))`,
        'message_count',
      )
      .addSelect('MAX(at.timestamp)', 'last_active')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'total_cost')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total_tokens')
      .where('at.agent_name IS NOT NULL')
      .andWhere('at.timestamp >= :statsCutoff', { statsCutoff });
    addTenantFilter(statsQb, userId, undefined, resolved);

    const sparkCutoff = computeCutoff('7 days');
    const dateExpr = sqlDateBucket('at.timestamp');
    const sparkQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect(dateExpr, 'date')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .where('at.timestamp >= :sparkCutoff', { sparkCutoff })
      .andWhere('at.agent_name IS NOT NULL');
    addTenantFilter(sparkQb, userId, undefined, resolved);

    const [agents, statsRows, sparkRows] = await Promise.all([
      agentQb.andWhere('a.is_active = true').orderBy('a.created_at', 'DESC').getMany(),
      statsQb.groupBy('at.agent_name').orderBy('last_active', 'DESC').getRawMany(),
      sparkQb
        .groupBy('at.agent_name')
        .addGroupBy('date')
        .orderBy('at.agent_name', 'ASC')
        .addOrderBy('date', 'ASC')
        .getRawMany(),
    ]);

    const statsMap = new Map<string, Record<string, unknown>>();
    for (const r of statsRows) {
      statsMap.set(String(r['agent_name']), r);
    }

    const sparkMap = new Map<string, number[]>();
    for (const r of sparkRows) {
      const name = String(r['agent_name']);
      if (!sparkMap.has(name)) sparkMap.set(name, []);
      sparkMap.get(name)!.push(Number(r['tokens'] ?? 0));
    }

    return agents.map((a) => {
      const name = a.name;
      const stats = statsMap.get(name);
      return {
        agent_name: name,
        display_name: a.display_name ?? name,
        agent_category: a.agent_category ?? null,
        agent_platform: a.agent_platform ?? null,
        message_count: Number(stats?.['message_count'] ?? 0),
        last_active: String(stats?.['last_active'] ?? a.created_at ?? ''),
        total_cost: Number(stats?.['total_cost'] ?? 0),
        total_tokens: Number(stats?.['total_tokens'] ?? 0),
        sparkline: sparkMap.get(name) ?? [],
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
