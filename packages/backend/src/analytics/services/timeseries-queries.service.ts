import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { addTenantFilter, downsample } from './query-helpers';

@Injectable()
export class TimeseriesQueriesService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  async getHourlyTokens(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("to_char(date_trunc('hour', at.timestamp), 'YYYY-MM-DD\"T\"HH24:MI:SS')", 'hour')
      .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'output_tokens')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('hour').orderBy('hour', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      hour: String(r['hour']),
      input_tokens: Number(r['input_tokens'] ?? 0),
      output_tokens: Number(r['output_tokens'] ?? 0),
    }));
  }

  async getDailyTokens(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("to_char(at.timestamp::date, 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'output_tokens')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('date').orderBy('date', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      date: String(r['date']),
      input_tokens: Number(r['input_tokens'] ?? 0),
      output_tokens: Number(r['output_tokens'] ?? 0),
    }));
  }

  async getHourlyCosts(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("to_char(date_trunc('hour', at.timestamp), 'YYYY-MM-DD\"T\"HH24:MI:SS')", 'hour')
      .addSelect('COALESCE(SUM(at.cost_usd), 0)', 'cost')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('hour').orderBy('hour', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      hour: String(r['hour']),
      cost: Number(r['cost'] ?? 0),
    }));
  }

  async getDailyCosts(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("to_char(at.timestamp::date, 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(at.cost_usd), 0)', 'cost')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('date').orderBy('date', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      date: String(r['date']),
      cost: Number(r['cost'] ?? 0),
    }));
  }

  async getHourlyMessages(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("to_char(date_trunc('hour', at.timestamp), 'YYYY-MM-DD\"T\"HH24:MI:SS')", 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('hour').orderBy('hour', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      hour: String(r['hour']),
      count: Number(r['count'] ?? 0),
    }));
  }

  async getDailyMessages(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("to_char(at.timestamp::date, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('date').orderBy('date', 'ASC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      date: String(r['date']),
      count: Number(r['count'] ?? 0),
    }));
  }

  async getActiveSkills(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.skill_name', 'name')
      .addSelect('MIN(at.agent_name)', 'agent_name')
      .addSelect('COUNT(*)', 'run_count')
      .addSelect('MAX(at.timestamp)', 'last_active_at')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()')
      .andWhere('at.skill_name IS NOT NULL');
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('at.skill_name').orderBy('run_count', 'DESC').getRawMany();
    return rows.map((r: Record<string, unknown>) => ({
      name: String(r['name']),
      agent_name: r['agent_name'] ? String(r['agent_name']) : null,
      run_count: Number(r['run_count'] ?? 0),
      last_active_at: String(r['last_active_at']),
      status: 'active' as const,
    }));
  }

  async getRecentActivity(range: string, userId: string, limit = 5, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.id', 'id')
      .addSelect('at.timestamp', 'timestamp')
      .addSelect('at.agent_name', 'agent_name')
      .addSelect('at.model', 'model')
      .addSelect('at.input_tokens', 'input_tokens')
      .addSelect('at.output_tokens', 'output_tokens')
      .addSelect('at.status', 'status')
      .addSelect('at.input_tokens + at.output_tokens', 'total_tokens')
      .addSelect('at.cost_usd::float', 'cost')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()');
    addTenantFilter(qb, userId, agentName);
    return qb.orderBy('at.timestamp', 'DESC').limit(limit).getRawMany();
  }

  async getCostByModel(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .select("COALESCE(at.model, 'unknown')", 'model')
      .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
      .addSelect('COALESCE(SUM(at.cost_usd), 0)', 'estimated_cost')
      .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('at.timestamp <= NOW()')
      .andWhere('at.model IS NOT NULL')
      .andWhere("at.model != ''");
    addTenantFilter(qb, userId, agentName);
    const rows = await qb.groupBy('at.model').orderBy('tokens', 'DESC').getRawMany();

    const totalTokens = rows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + Number(r['tokens'] ?? 0), 0,
    );
    return rows.map((r: Record<string, unknown>) => ({
      model: String(r['model']),
      tokens: Number(r['tokens'] ?? 0),
      share_pct: totalTokens === 0 ? 0 : Math.round((Number(r['tokens'] ?? 0) / totalTokens) * 1000) / 10,
      estimated_cost: Number(r['estimated_cost'] ?? 0),
    }));
  }

  async getAgentList(userId: string) {
    const agents = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.is_active = true')
      .orderBy('a.created_at', 'DESC')
      .getMany();

    const statsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect('COUNT(*)', 'message_count')
      .addSelect('MAX(at.timestamp)', 'last_active')
      .addSelect('COALESCE(SUM(at.cost_usd::float), 0)', 'total_cost')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total_tokens')
      .where('at.agent_name IS NOT NULL');
    addTenantFilter(statsQb, userId);
    const statsRows = await statsQb.groupBy('at.agent_name').orderBy('last_active', 'DESC').getRawMany();

    const statsMap = new Map<string, Record<string, unknown>>();
    for (const r of statsRows) {
      statsMap.set(String(r['agent_name']), r);
    }

    const sparkQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect("to_char(date_trunc('hour', at.timestamp), 'YYYY-MM-DD\"T\"HH24:MI:SS')", 'hour')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .where("at.timestamp >= NOW() - '7 days'::interval")
      .andWhere('at.agent_name IS NOT NULL');
    addTenantFilter(sparkQb, userId);
    const sparkRows = await sparkQb
      .groupBy('at.agent_name')
      .addGroupBy('hour')
      .orderBy('at.agent_name', 'ASC')
      .addOrderBy('hour', 'ASC')
      .getRawMany();

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
        message_count: Number(stats?.['message_count'] ?? 0),
        last_active: String(stats?.['last_active'] ?? a.created_at ?? ''),
        total_cost: Number(stats?.['total_cost'] ?? 0),
        total_tokens: Number(stats?.['total_tokens'] ?? 0),
        sparkline: downsample(sparkMap.get(name) ?? [], 24),
      };
    });
  }
}
