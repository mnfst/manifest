import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import { MetricWithTrend, computeTrend, addTenantFilter } from './query-helpers';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import {
  DbDialect,
  detectDialect,
  computeCutoff,
  sqlSanitizeCost,
} from '../../common/utils/sql-dialect';

export { MetricWithTrend };

@Injectable()
export class AggregationService {
  private readonly dialect: DbDialect;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    private readonly dataSource: DataSource,
    private readonly tenantCache: TenantCacheService,
  ) {
    this.dialect = detectDialect(this.dataSource.options.type as string);
  }

  async hasAnyData(userId: string, agentName?: string, tenantId?: string): Promise<boolean> {
    const resolved = tenantId ?? (await this.tenantCache.resolve(userId)) ?? undefined;
    const qb = this.turnRepo.createQueryBuilder('at').select('1').limit(1);
    addTenantFilter(qb, userId, agentName, resolved);
    const row = await qb.getRawOne();
    return row != null;
  }

  async getTokenSummary(range: string, userId: string, agentName?: string) {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    // 3A: Merge current total + breakdown into one query (total = input + output)
    const detailQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens), 0)', 'inp')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'out')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(detailQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

    const [detail, prevRow] = await Promise.all([detailQb.getRawOne(), prevQb.getRawOne()]);

    const inputTotal = Number(detail?.inp ?? 0);
    const outputTotal = Number(detail?.out ?? 0);
    const current = inputTotal + outputTotal;
    const previous = Number(prevRow?.total ?? 0);

    return {
      tokens_today: {
        value: current,
        trend_pct: computeTrend(current, previous),
        sub_values: { input: inputTotal, output: outputTotal },
      } as MetricWithTrend,
      input_tokens: inputTotal,
      output_tokens: outputTotal,
    };
  }

  async getCostSummary(
    range: string,
    userId: string,
    agentName?: string,
  ): Promise<MetricWithTrend> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    // 3B: Parallelize current + previous period queries
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

    const [currentRow, prevRow] = await Promise.all([currentQb.getRawOne(), prevQb.getRawOne()]);

    const current = Number(currentRow?.total ?? 0);
    const previous = Number(prevRow?.total ?? 0);
    return { value: current, trend_pct: computeTrend(current, previous) };
  }

  async getMessageCount(
    range: string,
    userId: string,
    agentName?: string,
  ): Promise<MetricWithTrend> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    // 3C: Parallelize current + previous period queries
    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

    const [currentRow, prevRow] = await Promise.all([currentQb.getRawOne(), prevQb.getRawOne()]);

    const current = Number(currentRow?.total ?? 0);
    const previous = Number(prevRow?.total ?? 0);
    return { value: current, trend_pct: computeTrend(current, previous) };
  }

  async getPreviousTokenTotal(range: string, userId: string, agentName?: string): Promise<number> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);
    const row = await prevQb.getRawOne();
    return Number(row?.total ?? 0);
  }

  async getPreviousCostTotal(range: string, userId: string, agentName?: string): Promise<number> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    const safeCost = sqlSanitizeCost('at.cost_usd');
    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);
    const row = await prevQb.getRawOne();
    return Number(row?.total ?? 0);
  }

  async getSummaryMetrics(range: string, userId: string, tenantId?: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    const safeCost = sqlSanitizeCost('at.cost_usd');

    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'msg_count')
      .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'inp')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'out')
      .addSelect(`COALESCE(SUM(${safeCost}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'msg_count')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${safeCost}), 0)`, 'cost')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

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
}
