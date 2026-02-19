import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import {
  rangeToInterval,
  rangeToPreviousInterval,
} from '../../common/utils/range.util';
import { computeTrend } from './query-helpers';

interface AgentScope {
  tenantId: string;
  agentId: string;
}

export interface AgentUsageResult {
  range: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  message_count: number;
  trend_pct: number;
}

export interface AgentCostsResult {
  range: string;
  total_cost_usd: number;
  trend_pct: number;
  by_model: { model: string; cost_usd: number; input_tokens: number; output_tokens: number }[];
}

@Injectable()
export class AgentAnalyticsService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
  ) {}

  async getUsage(range: string, scope: AgentScope): Promise<AgentUsageResult> {
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);

    const [currentRows, prevRows] = await Promise.all([
      this.turnRepo
        .createQueryBuilder('at')
        .select('COALESCE(SUM(at.input_tokens), 0)', 'input')
        .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'output')
        .addSelect('COALESCE(SUM(at.cache_read_tokens), 0)', 'cache_read')
        .addSelect('COUNT(*)', 'messages')
        .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
        .andWhere('at.timestamp <= NOW()')
        .andWhere('at.tenant_id = :tenantId', { tenantId: scope.tenantId })
        .andWhere('at.agent_id = :agentId', { agentId: scope.agentId })
        .getRawOne(),
      this.turnRepo
        .createQueryBuilder('at')
        .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
        .where('at.timestamp >= NOW() - CAST(:prevInterval AS interval)', { prevInterval })
        .andWhere('at.timestamp < NOW() - CAST(:interval AS interval)', { interval })
        .andWhere('at.tenant_id = :tenantId', { tenantId: scope.tenantId })
        .andWhere('at.agent_id = :agentId', { agentId: scope.agentId })
        .getRawOne(),
    ]);

    const input = Number(currentRows?.input ?? 0);
    const output = Number(currentRows?.output ?? 0);
    const cacheRead = Number(currentRows?.cache_read ?? 0);
    const messages = Number(currentRows?.messages ?? 0);
    const currentTotal = input + output;
    const previousTotal = Number(prevRows?.total ?? 0);

    return {
      range,
      total_tokens: currentTotal,
      input_tokens: input,
      output_tokens: output,
      cache_read_tokens: cacheRead,
      message_count: messages,
      trend_pct: computeTrend(currentTotal, previousTotal),
    };
  }

  async getCosts(range: string, scope: AgentScope): Promise<AgentCostsResult> {
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);

    const [currentRows, prevRows, modelRows] = await Promise.all([
      this.turnRepo
        .createQueryBuilder('at')
        .select('COALESCE(SUM(at.cost_usd), 0)', 'total')
        .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
        .andWhere('at.timestamp <= NOW()')
        .andWhere('at.tenant_id = :tenantId', { tenantId: scope.tenantId })
        .andWhere('at.agent_id = :agentId', { agentId: scope.agentId })
        .getRawOne(),
      this.turnRepo
        .createQueryBuilder('at')
        .select('COALESCE(SUM(at.cost_usd), 0)', 'total')
        .where('at.timestamp >= NOW() - CAST(:prevInterval AS interval)', { prevInterval })
        .andWhere('at.timestamp < NOW() - CAST(:interval AS interval)', { interval })
        .andWhere('at.tenant_id = :tenantId', { tenantId: scope.tenantId })
        .andWhere('at.agent_id = :agentId', { agentId: scope.agentId })
        .getRawOne(),
      this.turnRepo
        .createQueryBuilder('at')
        .select('at.model', 'model')
        .addSelect('COALESCE(SUM(at.cost_usd), 0)', 'cost_usd')
        .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'input_tokens')
        .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'output_tokens')
        .where('at.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
        .andWhere('at.timestamp <= NOW()')
        .andWhere('at.tenant_id = :tenantId', { tenantId: scope.tenantId })
        .andWhere('at.agent_id = :agentId', { agentId: scope.agentId })
        .andWhere('at.model IS NOT NULL')
        .groupBy('at.model')
        .orderBy('cost_usd', 'DESC')
        .getRawMany(),
    ]);

    const currentCost = Number(currentRows?.total ?? 0);
    const previousCost = Number(prevRows?.total ?? 0);

    return {
      range,
      total_cost_usd: currentCost,
      trend_pct: computeTrend(currentCost, previousCost),
      by_model: modelRows.map((r: Record<string, unknown>) => ({
        model: String(r['model']),
        cost_usd: Number(r['cost_usd']),
        input_tokens: Number(r['input_tokens']),
        output_tokens: Number(r['output_tokens']),
      })),
    };
  }
}
