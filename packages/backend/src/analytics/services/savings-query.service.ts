import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import {
  computeCutoff,
  sqlSanitizeCost,
  sqlDateBucket,
  sqlHourBucket,
} from '../../common/utils/postgres-sql';
import { addTenantFilter, computeTrend } from './query-helpers';
import {
  pickMostExpensiveRoutedModel,
  collectRoutedModelIds,
} from '../../common/utils/baseline-cost';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { HeaderTier } from '../../entities/header-tier.entity';

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

export interface SavingsTimeseriesRow {
  date?: string;
  hour?: string;
  actual_cost: number;
  baseline_cost: number;
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
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    @InjectRepository(SpecificityAssignment)
    private readonly specificityRepo: Repository<SpecificityAssignment>,
    @InjectRepository(HeaderTier)
    private readonly headerTierRepo: Repository<HeaderTier>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async getSavings(
    range: string,
    userId: string,
    agentName: string,
    tenantId?: string,
    baselineOverride?: string,
  ): Promise<SavingsResult> {
    if (!baselineOverride) {
      return this.getSavingsAuto(range, userId, agentName, tenantId);
    }

    const agent = await this.agentRepo.findOne({
      where: tenantId ? { tenant_id: tenantId, name: agentName } : { name: agentName },
    });

    if (!agent) return this.emptySavings();

    return this.getSavingsOverride(range, userId, agentName, agent, baselineOverride, tenantId);
  }

  async getSavingsTimeseries(
    range: string,
    userId: string,
    agentName: string,
    tenantId?: string,
  ): Promise<SavingsTimeseriesRow[]> {
    const fallback = await this.resolveFallbackBaseline(agentName, tenantId);
    const fbInput = fallback?.input ?? 0;
    const fbOutput = fallback?.output ?? 0;

    const cutoff = computeCutoff(rangeToInterval(range));
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const safeBaseline = sqlSanitizeCost('at.baseline_cost_usd');

    const baselineExpr = `COALESCE(
      CASE WHEN ${safeBaseline} IS NOT NULL THEN ${safeBaseline} END,
      at.input_tokens * :fbInput::double precision + at.output_tokens * :fbOutput::double precision
    )`;

    const isHourly = range === '24h';
    const bucket = isHourly ? sqlHourBucket('at.timestamp') : sqlDateBucket('at.timestamp');

    const qb = this.messageRepo.createQueryBuilder('at');
    addTenantFilter(qb, userId, agentName, tenantId);
    qb.andWhere('at.timestamp >= :cutoff', { cutoff });
    qb.andWhere("at.status = 'ok'");

    qb.select(bucket, 'bucket');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END), 0)`,
      'actual_cost',
    );
    qb.addSelect(`COALESCE(SUM(${baselineExpr}), 0)`, 'baseline_cost');
    qb.groupBy('bucket');
    qb.orderBy('bucket', 'ASC');
    qb.setParameters({ fbInput, fbOutput });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      ...(isHourly ? { hour: r.bucket } : { date: r.bucket }),
      actual_cost: Number(r.actual_cost),
      baseline_cost: Number(r.baseline_cost),
    }));
  }

  private async getSavingsAuto(
    range: string,
    userId: string,
    agentName: string,
    tenantId?: string,
  ): Promise<SavingsResult> {
    // For messages with stored baseline_cost_usd (V2+), use it directly.
    // For older messages without it (pre-V2), fall back to a query-time
    // calculation using the cheapest reasoning model from current providers.
    const fallback = await this.resolveFallbackBaseline(agentName, tenantId);
    const fbInput = fallback?.input ?? 0;
    const fbOutput = fallback?.output ?? 0;

    const cutoff = computeCutoff(rangeToInterval(range));
    const prevCutoff = computeCutoff(rangeToPreviousInterval(range));
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const safeBaseline = sqlSanitizeCost('at.baseline_cost_usd');

    // COALESCE: use stored baseline if available, otherwise compute from fallback prices
    const baselineExpr = `COALESCE(
      CASE WHEN ${safeBaseline} IS NOT NULL THEN ${safeBaseline} END,
      at.input_tokens * :fbInput::double precision + at.output_tokens * :fbOutput::double precision
    )`;

    const qb = this.messageRepo.createQueryBuilder('at');
    addTenantFilter(qb, userId, agentName, tenantId);
    qb.andWhere('at.timestamp >= :cutoff', { cutoff });
    qb.andWhere("at.status = 'ok'");

    // Per-request savings clamped to 0: you never "lose" money by choosing
    // a more expensive model. You either saved money or you didn't.
    const perRequestSaved = `GREATEST(${baselineExpr} - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END, 0)`;

    qb.select('COUNT(*)::int', 'request_count');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END), 0)`,
      'actual_cost',
    );
    qb.addSelect(`COALESCE(SUM(${baselineExpr}), 0)`, 'baseline_cost');
    qb.addSelect(`COALESCE(SUM(${perRequestSaved}), 0)`, 'total_saved');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'api_key' THEN ${perRequestSaved} ELSE 0 END), 0)`,
      'saved_api_key',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'subscription' THEN ${perRequestSaved} ELSE 0 END), 0)`,
      'saved_subscription',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'local' THEN ${perRequestSaved} ELSE 0 END), 0)`,
      'saved_local',
    );

    qb.setParameters({ fbInput, fbOutput });

    const row = await qb.getRawOne();

    const totalSaved = Number(row?.total_saved ?? 0);
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
      `COALESCE(SUM(GREATEST(${baselineExpr} - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END, 0)), 0)`,
      'prev_saved',
    );
    prevQb.setParameters({ fbInput, fbOutput });
    const prevRow = await prevQb.getRawOne();
    const prevSaved = Number(prevRow?.prev_saved ?? 0);

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
    baselineModelId: string,
    tenantId?: string,
  ): Promise<SavingsResult> {
    const { baseline, overrideStale } = await this.resolveOverrideBaseline(agent, baselineModelId);
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

    const overrideBaselineExpr = `(at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision)`;
    const overridePerRequestSaved = `GREATEST(${overrideBaselineExpr} - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END, 0)`;

    qb.select('COUNT(*)::int', 'request_count');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END), 0)`,
      'actual_cost',
    );
    qb.addSelect(`COALESCE(SUM(${overrideBaselineExpr}), 0)`, 'baseline_cost');
    qb.addSelect(`COALESCE(SUM(${overridePerRequestSaved}), 0)`, 'total_saved');
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'api_key' THEN ${overridePerRequestSaved} ELSE 0 END), 0)`,
      'saved_api_key',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'subscription' THEN ${overridePerRequestSaved} ELSE 0 END), 0)`,
      'saved_subscription',
    );
    qb.addSelect(
      `COALESCE(SUM(CASE WHEN at.auth_type = 'local' THEN ${overridePerRequestSaved} ELSE 0 END), 0)`,
      'saved_local',
    );

    qb.setParameters({ inputPrice, outputPrice });

    const row = await qb.getRawOne();

    const totalSaved = Number(row?.total_saved ?? 0);
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
      `COALESCE(SUM(GREATEST(
        (at.input_tokens * :inputPrice::double precision + at.output_tokens * :outputPrice::double precision)
        - CASE WHEN ${safeCost} IS NOT NULL THEN ${safeCost} ELSE 0 END
      , 0)), 0)`,
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
    modelId: string,
  ): Promise<{ baseline: BaselineModel | null; overrideStale: boolean }> {
    const providers = await this.providerRepo.find({
      where: { agent_id: agent.id, is_active: true },
    });

    const overrideModel = this.findModelById(providers, modelId);
    if (overrideModel) {
      return {
        baseline: this.toBaselineModel(overrideModel),
        overrideStale: false,
      };
    }

    const historical = await this.getHistoricalModels(agent.id);
    const historicalMatch = historical.find((h) => h.id === modelId);
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

  private async resolveFallbackBaseline(
    agentName: string,
    tenantId?: string,
  ): Promise<{ input: number; output: number } | null> {
    try {
      const agent = await this.agentRepo.findOne({
        where: tenantId ? { tenant_id: tenantId, name: agentName } : { name: agentName },
      });
      if (!agent) return null;
      const [providers, tiers, specificityAssignments, headerTiers] = await Promise.all([
        this.providerRepo.find({ where: { agent_id: agent.id, is_active: true } }),
        this.tierRepo.find({ where: { agent_id: agent.id } }),
        this.specificityRepo.find({ where: { agent_id: agent.id } }),
        this.headerTierRepo.find({ where: { agent_id: agent.id } }),
      ]);
      const routedModelIds = collectRoutedModelIds([
        ...tiers,
        ...specificityAssignments,
        ...headerTiers,
      ]);
      const model = pickMostExpensiveRoutedModel(providers, routedModelIds, this.pricingCache);
      if (!model) return null;
      return {
        input: model.inputPricePerToken!,
        output: model.outputPricePerToken!,
      };
    } catch {
      return null;
    }
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
