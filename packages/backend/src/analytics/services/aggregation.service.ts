import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import { MetricWithTrend, computeTrend, addTenantFilter } from './query-helpers';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { computeCutoff, sqlSanitizeCost } from '../../common/utils/postgres-sql';

export { MetricWithTrend };

interface RangeWindow {
  cutoff: string;
  prevCutoff: string;
}

@Injectable()
export class AggregationService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async hasAnyData(userId: string, agentName?: string, tenantId?: string): Promise<boolean> {
    const resolved = tenantId ?? (await this.tenantCache.resolve(userId)) ?? undefined;
    const qb = this.turnRepo.createQueryBuilder('at').select('1').limit(1);
    addTenantFilter(qb, userId, agentName, resolved);
    const row = await qb.getRawOne();
    return row != null;
  }

  async getPreviousTokenTotal(range: string, userId: string, agentName?: string): Promise<number> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const row = await this.buildPreviousWindowQuery(userId, agentName, tenantId, cutoff, prevCutoff)
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .getRawOne();
    return Number(row?.total ?? 0);
  }

  async getPreviousCostTotal(range: string, userId: string, agentName?: string): Promise<number> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const row = await this.buildPreviousWindowQuery(userId, agentName, tenantId, cutoff, prevCutoff)
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .getRawOne();
    return Number(row?.total ?? 0);
  }

  async getSummaryMetrics(range: string, userId: string, tenantId?: string, agentName?: string) {
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const safeCost = sqlSanitizeCost('at.cost_usd');

    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'msg_count')
      .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'inp')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'out')
      .addSelect(`COALESCE(SUM(${safeCost}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName, tenantId);

    const prevQb = this.buildPreviousWindowQuery(userId, agentName, tenantId, cutoff, prevCutoff)
      .select('COUNT(*)', 'msg_count')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${safeCost}), 0)`, 'cost');

    const [cur, prev] = await Promise.all([currentQb.getRawOne(), prevQb.getRawOne()]);

    const inputTotal = Number(cur?.inp ?? 0);
    const outputTotal = Number(cur?.out ?? 0);
    const curTokens = inputTotal + outputTotal;
    const prevTokens = Number(prev?.tokens ?? 0);
    const curCost = Number(cur?.cost ?? 0);
    const prevCost = Number(prev?.cost ?? 0);
    const curMsgs = Number(cur?.msg_count ?? 0);
    const prevMsgs = Number(prev?.msg_count ?? 0);

    return {
      tokens: {
        tokens_today: {
          value: curTokens,
          trend_pct: computeTrend(curTokens, prevTokens),
          sub_values: { input: inputTotal, output: outputTotal },
        } as MetricWithTrend,
        input_tokens: inputTotal,
        output_tokens: outputTotal,
      },
      cost: { value: curCost, trend_pct: computeTrend(curCost, prevCost) } as MetricWithTrend,
      messages: { value: curMsgs, trend_pct: computeTrend(curMsgs, prevMsgs) } as MetricWithTrend,
    };
  }

  private computeWindow(range: string): RangeWindow {
    return {
      cutoff: computeCutoff(rangeToInterval(range)),
      prevCutoff: computeCutoff(rangeToPreviousInterval(range)),
    };
  }

  private buildPreviousWindowQuery(
    userId: string,
    agentName: string | undefined,
    tenantId: string | undefined,
    cutoff: string,
    prevCutoff: string,
  ): SelectQueryBuilder<AgentMessage> {
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(qb, userId, agentName, tenantId);
    return qb;
  }
}
