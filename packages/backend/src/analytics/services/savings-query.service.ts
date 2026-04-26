import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import { computeCutoff, sqlSanitizeCost } from '../../common/utils/postgres-sql';
import { addTenantFilter, computeTrend } from './query-helpers';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

export interface BaselineModel {
  id: string;
  display_name: string;
  provider: string;
  input_price_per_token: number;
  output_price_per_token: number;
}

export interface SavingsResult {
  total_saved: number;
  savings_pct: number;
  actual_cost: number;
  baseline_cost: number;
  baseline_model: BaselineModel | null;
  baseline_override_stale: boolean;
  request_count: number;
  trend_pct: number;
  is_auto: boolean;
  savings_by_auth_type: {
    api_key: number;
    subscription: number;
    local: number;
  };
}

export interface BaselineCandidate {
  id: string;
  display_name: string;
  provider: string;
  input_price_per_token: number;
  output_price_per_token: number;
  price_per_million: number;
  is_current: boolean;
}

@Injectable()
export class SavingsQueryService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async getSavings(
    range: string,
    userId: string,
    agentName: string,
    tenantId?: string,
  ): Promise<SavingsResult> {
    const agent = await this.agentRepo.findOne({
      where: tenantId ? { tenant_id: tenantId, name: agentName } : { name: agentName },
    });

    if (!agent) return this.emptySavings();

    const isAuto = !agent.savings_baseline_model;

    if (isAuto) {
      return this.getSavingsAuto(range, userId, agentName, tenantId);
    }

    return this.getSavingsOverride(range, userId, agentName, agent, tenantId);
  }

  private async getSavingsAuto(
    range: string,
    userId: string,
    agentName: string,
    tenantId?: string,
  ): Promise<SavingsResult> {
    const cutoff = computeCutoff(rangeToInterval(range));
    const prevCutoff = computeCutoff(rangeToPreviousInterval(range));
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const safeBaseline = sqlSanitizeCost('at.baseline_cost_usd');

    const qb = this.messageRepo.createQueryBuilder('at');
    addTenantFilter(qb, userId, agentName, tenantId);
    qb.andWhere('at.timestamp >= :cutoff', { cutoff });
    qb.andWhere("at.status = 'ok'");

    qb.select('COUNT(*)::int', 'request_count');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END), 0)`,
      'actual_cost',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN ${safeBaseline} IS NOT NULL THEN ${safeBaseline} ELSE 0 END), 0)`,
      'baseline_cost',
    );
    qb.addSelect(
      `COALESCE(SUM(
        CASE WHEN ${safeBaseline} IS NOT NULL THEN ${safeBaseline} ELSE 0 END
        - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
      ), 0)`,
      'total_saved',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'api_key' AND ${safeBaseline} IS NOT NULL THEN
        ${safeBaseline} - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
        ELSE 0 END), 0)`,
      'saved_api_key',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'subscription' AND ${safeBaseline} IS NOT NULL THEN
        ${safeBaseline} ELSE 0 END), 0)`,
      'saved_subscription',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'local' AND ${safeBaseline} IS NOT NULL THEN
        ${safeBaseline} ELSE 0 END), 0)`,
      'saved_local',
    );

    const row = await qb.getRawOne();

    const totalSaved = Math.max(0, Number(row?.total_saved ?? 0));
    const baselineCost = Number(row?.baseline_cost ?? 0);
    const actualCost = Number(row?.actual_cost ?? 0);
    const requestCount = Number(row?.request_count ?? 0);
    const savingsPct = baselineCost > 0 ? Math.round((totalSaved / baselineCost) * 100) : 0;

    const prevQb = this.messageRepo.createQueryBuilder('at');
    addTenantFilter(prevQb, userId, agentName, tenantId);
    prevQb.andWhere('at.timestamp >= :prevCutoff AND at.timestamp < :cutoff', {
      prevCutoff,
      cutoff,
    });
    prevQb.andWhere("at.status = 'ok'");
    prevQb.select(
      `COALESCE(SUM(
        CASE WHEN ${safeBaseline} IS NOT NULL THEN ${safeBaseline} ELSE 0 END
        - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
      ), 0)`,
      'prev_saved',
    );
    const prevRow = await prevQb.getRawOne();
    const prevSaved = Math.max(0, Number(prevRow?.prev_saved ?? 0));

    return {
      total_saved: totalSaved,
      savings_pct: savingsPct,
      actual_cost: actualCost,
      baseline_cost: baselineCost,
      baseline_model: null,
      baseline_override_stale: false,
      request_count: requestCount,
      trend_pct: computeTrend(totalSaved, prevSaved),
      is_auto: true,
      savings_by_auth_type: {
        api_key: Math.max(0, Number(row?.saved_api_key ?? 0)),
        subscription: Math.max(0, Number(row?.saved_subscription ?? 0)),
        local: Math.max(0, Number(row?.saved_local ?? 0)),
      },
    };
  }

  private async getSavingsOverride(
    range: string,
    userId: string,
    agentName: string,
    agent: Agent,
    tenantId?: string,
  ): Promise<SavingsResult> {
    const { baseline, overrideStale } = await this.resolveOverrideBaseline(agent);
    if (!baseline) return this.emptySavings();

    const inputPrice = baseline.input_price_per_token;
    const outputPrice = baseline.output_price_per_token;

    const cutoff = computeCutoff(rangeToInterval(range));
    const prevCutoff = computeCutoff(rangeToPreviousInterval(range));
    const safeCost = sqlSanitizeCost('at.cost_usd');

    const qb = this.messageRepo.createQueryBuilder('at');
    addTenantFilter(qb, userId, agentName, tenantId);
    qb.andWhere('at.timestamp >= :cutoff', { cutoff });
    qb.andWhere("at.status = 'ok'");

    qb.select('COUNT(*)::int', 'request_count');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END), 0)`,
      'actual_cost',
    );
    qb.addSelect(
      `COALESCE(SUM(at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision), 0)`,
      'baseline_cost',
    );
    qb.addSelect(
      `COALESCE(SUM(
        (at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision)
        - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
      ), 0)`,
      'total_saved',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'api_key' THEN
        (at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision)
        - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
        ELSE 0 END), 0)`,
      'saved_api_key',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'subscription' THEN
        at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision
        ELSE 0 END), 0)`,
      'saved_subscription',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'local' THEN
        at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision
        ELSE 0 END), 0)`,
      'saved_local',
    );

    qb.setParameters({ inputPrice, outputPrice });

    const row = await qb.getRawOne();

    const totalSaved = Math.max(0, Number(row?.total_saved ?? 0));
    const baselineCost = Number(row?.baseline_cost ?? 0);
    const actualCost = Number(row?.actual_cost ?? 0);
    const requestCount = Number(row?.request_count ?? 0);
    const savingsPct = baselineCost > 0 ? Math.round((totalSaved / baselineCost) * 100) : 0;

    const prevQb = this.messageRepo.createQueryBuilder('at');
    addTenantFilter(prevQb, userId, agentName, tenantId);
    prevQb.andWhere('at.timestamp >= :prevCutoff AND at.timestamp < :cutoff', {
      prevCutoff,
      cutoff,
    });
    prevQb.andWhere("at.status = 'ok'");
    prevQb.select(
      `COALESCE(SUM(
        (at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision)
        - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
      ), 0)`,
      'prev_saved',
    );
    prevQb.setParameters({ inputPrice, outputPrice });
    const prevRow = await prevQb.getRawOne();
    const prevSaved = Math.max(0, Number(prevRow?.prev_saved ?? 0));

    return {
      total_saved: totalSaved,
      savings_pct: savingsPct,
      actual_cost: actualCost,
      baseline_cost: baselineCost,
      baseline_model: baseline,
      baseline_override_stale: overrideStale,
      request_count: requestCount,
      trend_pct: computeTrend(totalSaved, prevSaved),
      is_auto: false,
      savings_by_auth_type: {
        api_key: Math.max(0, Number(row?.saved_api_key ?? 0)),
        subscription: Math.max(0, Number(row?.saved_subscription ?? 0)),
        local: Math.max(0, Number(row?.saved_local ?? 0)),
      },
    };
  }

  async getBaselineCandidates(
    agentId: string,
    currentBaselineId: string | null,
  ): Promise<BaselineCandidate[]> {
    const providers = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });

    const candidates: BaselineCandidate[] = [];
    const seen = new Set<string>();

    for (const p of providers) {
      if (!p.cached_models) continue;
      let models: DiscoveredModel[];
      try {
        models =
          typeof p.cached_models === 'string' ? JSON.parse(p.cached_models) : p.cached_models;
      } catch {
        continue;
      }
      if (!Array.isArray(models)) continue;
      for (const m of models) {
        if (
          !m ||
          typeof m.inputPricePerToken !== 'number' ||
          typeof m.outputPricePerToken !== 'number' ||
          m.inputPricePerToken <= 0 ||
          m.outputPricePerToken <= 0
        ) {
          continue;
        }
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        const totalPerM = (m.inputPricePerToken + m.outputPricePerToken) * 1_000_000;
        candidates.push({
          id: m.id,
          display_name: m.displayName ?? m.id,
          provider: m.provider ?? 'unknown',
          input_price_per_token: m.inputPricePerToken,
          output_price_per_token: m.outputPricePerToken,
          price_per_million: Math.round(totalPerM * 100) / 100,
          is_current: m.id === currentBaselineId,
        });
      }
    }

    const historical = await this.getHistoricalModels(agentId);
    for (const h of historical) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const totalPerM = (h.input_price_per_token + h.output_price_per_token) * 1_000_000;
      candidates.push({
        id: h.id,
        display_name: h.display_name,
        provider: h.provider,
        input_price_per_token: h.input_price_per_token,
        output_price_per_token: h.output_price_per_token,
        price_per_million: Math.round(totalPerM * 100) / 100,
        is_current: h.id === currentBaselineId,
      });
    }

    candidates.sort((a, b) => a.price_per_million - b.price_per_million);
    return candidates;
  }

  async updateBaseline(agentId: string, modelId: string | null): Promise<void> {
    await this.agentRepo.update(agentId, {
      savings_baseline_model: modelId,
    });
  }

  private async resolveOverrideBaseline(
    agent: Agent,
  ): Promise<{ baseline: BaselineModel | null; overrideStale: boolean }> {
    if (!agent.savings_baseline_model) {
      return { baseline: null, overrideStale: false };
    }

    const providers = await this.providerRepo.find({
      where: { agent_id: agent.id, is_active: true },
    });

    const overrideModel = this.findModelById(providers, agent.savings_baseline_model);
    if (overrideModel) {
      return {
        baseline: this.toBaselineModel(overrideModel),
        overrideStale: false,
      };
    }

    const historical = await this.getHistoricalModels(agent.id);
    const historicalMatch = historical.find((h) => h.id === agent.savings_baseline_model);
    if (historicalMatch) {
      return { baseline: historicalMatch, overrideStale: false };
    }

    return { baseline: null, overrideStale: true };
  }

  private async getHistoricalModels(agentId: string): Promise<BaselineModel[]> {
    const rows: Array<{ model: string }> = await this.messageRepo
      .createQueryBuilder('at')
      .select('DISTINCT at.model', 'model')
      .where('at.agent_id = :agentId', { agentId })
      .andWhere('at.model IS NOT NULL')
      .getRawMany();

    const results: BaselineModel[] = [];
    for (const row of rows) {
      const pricing = this.pricingCache.getByModel(row.model);
      if (
        !pricing ||
        pricing.input_price_per_token == null ||
        pricing.output_price_per_token == null ||
        pricing.input_price_per_token <= 0 ||
        pricing.output_price_per_token <= 0
      ) {
        continue;
      }
      results.push({
        id: row.model,
        display_name: pricing.display_name ?? row.model,
        provider: pricing.provider ?? 'unknown',
        input_price_per_token: pricing.input_price_per_token,
        output_price_per_token: pricing.output_price_per_token,
      });
    }
    return results;
  }

  private findModelById(providers: UserProvider[], modelId: string): DiscoveredModel | null {
    for (const p of providers) {
      if (!p.cached_models || !p.is_active) continue;
      let models: DiscoveredModel[];
      try {
        models =
          typeof p.cached_models === 'string' ? JSON.parse(p.cached_models) : p.cached_models;
      } catch {
        continue;
      }
      if (!Array.isArray(models)) continue;
      for (const m of models) {
        if (
          m?.id === modelId &&
          typeof m.inputPricePerToken === 'number' &&
          typeof m.outputPricePerToken === 'number' &&
          m.inputPricePerToken > 0 &&
          m.outputPricePerToken > 0
        ) {
          return m;
        }
      }
    }
    return null;
  }

  private toBaselineModel(m: DiscoveredModel): BaselineModel {
    return {
      id: m.id,
      display_name: m.displayName ?? m.id,
      provider: m.provider ?? 'unknown',
      input_price_per_token: m.inputPricePerToken!,
      output_price_per_token: m.outputPricePerToken!,
    };
  }

  private emptySavings(): SavingsResult {
    return {
      total_saved: 0,
      savings_pct: 0,
      actual_cost: 0,
      baseline_cost: 0,
      baseline_model: null,
      baseline_override_stale: false,
      request_count: 0,
      trend_pct: 0,
      is_auto: true,
      savings_by_auth_type: {
        api_key: 0,
        subscription: 0,
        local: 0,
      },
    };
  }
}
