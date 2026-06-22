import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import {
  MetricWithTrend,
  computeTrend,
  addTenantFilter,
  excludePlaygroundAgents,
  scopeToConnection,
} from './query-helpers';
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
  ) {}

  async hasAnyData(
    tenantId: string | null,
    agentName?: string,
    excludePlayground = false,
  ): Promise<boolean> {
    const qb = this.turnRepo.createQueryBuilder('at').select('1').limit(1);
    addTenantFilter(qb, tenantId, agentName);
    // Mirror the overview's exclusion: a tenant whose only traffic is Playground
    // must read as empty, or has_data=true paints a non-empty state over cards
    // and charts that all dropped Playground and so render blank.
    if (excludePlayground) excludePlaygroundAgents(qb);
    const row = await qb.getRawOne();
    return row != null;
  }

  async getPreviousTokenTotal(
    range: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<number> {
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const row = await this.buildPreviousWindowQuery(tenantId, agentName, cutoff, prevCutoff)
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .getRawOne();
    return Number(row?.total ?? 0);
  }

  async getPreviousCostTotal(
    range: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<number> {
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const row = await this.buildPreviousWindowQuery(tenantId, agentName, cutoff, prevCutoff)
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .getRawOne();
    return Number(row?.total ?? 0);
  }

  async getSummaryMetrics(
    range: string,
    tenantId: string | null,
    agentName?: string,
    authType?: string,
    provider?: string,
    excludePlayground = false,
    label?: string,
    tenantProviderId?: string,
  ) {
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const safeCost = sqlSanitizeCost('at.cost_usd');

    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'msg_count')
      .addSelect('COALESCE(SUM(at.input_tokens), 0)', 'inp')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'out')
      .addSelect(`COALESCE(SUM(${safeCost}), 0)`, 'cost')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, tenantId, agentName);
    if (authType) currentQb.andWhere('at.auth_type = :authType', { authType });
    if (provider) currentQb.andWhere('at.provider = :provider', { provider });
    if (excludePlayground) excludePlaygroundAgents(currentQb);
    scopeToConnection(currentQb, tenantProviderId, label);

    const prevQb = this.buildPreviousWindowQuery(
      tenantId,
      agentName,
      cutoff,
      prevCutoff,
      authType,
      provider,
      excludePlayground,
      label,
      tenantProviderId,
    )
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

  /**
   * Raw totals for the window *before* the current one, used only to compute the
   * trend arrows on the Overview summary cards. The Overview derives its
   * current-window totals by summing the timeseries buckets it already fetches
   * (see AggregationService.buildSummary), so it no longer needs the full
   * current+previous double-scan that getSummaryMetrics runs for the per-agent /
   * per-connection widgets.
   */
  async getPreviousWindowMetrics(
    range: string,
    tenantId: string | null,
    agentName?: string,
    excludePlayground = false,
  ): Promise<{ tokens: number; cost: number; messages: number }> {
    const { cutoff, prevCutoff } = this.computeWindow(range);
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const prev = await this.buildPreviousWindowQuery(
      tenantId,
      agentName,
      cutoff,
      prevCutoff,
      undefined,
      undefined,
      excludePlayground,
    )
      .select('COUNT(*)', 'msg_count')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${safeCost}), 0)`, 'cost')
      .getRawOne();
    return {
      tokens: Number(prev?.tokens ?? 0),
      cost: Number(prev?.cost ?? 0),
      messages: Number(prev?.msg_count ?? 0),
    };
  }

  /**
   * Assemble the Overview summary cards (value + trend vs the previous window)
   * from already-computed current totals and previous-window totals. Pure (no
   * DB) so the current totals can be sourced from the timeseries buckets.
   */
  static buildSummary(
    current: { input: number; output: number; cost: number; messages: number },
    previous: { tokens: number; cost: number; messages: number },
  ): {
    tokens: { tokens_today: MetricWithTrend; input_tokens: number; output_tokens: number };
    cost: MetricWithTrend;
    messages: MetricWithTrend;
  } {
    const curTokens = current.input + current.output;
    return {
      tokens: {
        tokens_today: {
          value: curTokens,
          trend_pct: computeTrend(curTokens, previous.tokens),
          sub_values: { input: current.input, output: current.output },
        },
        input_tokens: current.input,
        output_tokens: current.output,
      },
      cost: { value: current.cost, trend_pct: computeTrend(current.cost, previous.cost) },
      messages: {
        value: current.messages,
        trend_pct: computeTrend(current.messages, previous.messages),
      },
    };
  }

  private computeWindow(range: string): RangeWindow {
    return {
      cutoff: computeCutoff(rangeToInterval(range)),
      prevCutoff: computeCutoff(rangeToPreviousInterval(range)),
    };
  }

  private buildPreviousWindowQuery(
    tenantId: string | null,
    agentName: string | undefined,
    cutoff: string,
    prevCutoff: string,
    authType?: string,
    provider?: string,
    excludePlayground = false,
    label?: string,
    tenantProviderId?: string,
  ): SelectQueryBuilder<AgentMessage> {
    const qb = this.turnRepo
      .createQueryBuilder('at')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(qb, tenantId, agentName);
    if (authType) qb.andWhere('at.auth_type = :authType', { authType });
    if (provider) qb.andWhere('at.provider = :provider', { provider });
    if (excludePlayground) excludePlaygroundAgents(qb);
    scopeToConnection(qb, tenantProviderId, label);
    return qb;
  }
}
