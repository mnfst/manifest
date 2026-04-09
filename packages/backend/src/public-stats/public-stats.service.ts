import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import {
  DbDialect,
  detectDialect,
  computeCutoff,
  sqlDateBucket,
} from '../common/utils/sql-dialect';

const MAX_RESULTS = 10;
const EXCLUDED_PROVIDERS = new Set(['Unknown']);

export interface TopModel {
  model: string;
  provider: string;
  tokens_7d: number;
  tokens_previous_7d: number;
  tokens_30d: number;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  usage_rank: number;
}

export interface UsageStats {
  total_messages: number;
  top_models: TopModel[];
  token_map: Map<string, number>;
}

export interface FreeModel {
  model_name: string;
  provider: string;
  tokens_7d: number;
}

export interface DailyModelTokens {
  date: string;
  tokens: number;
}

export interface ModelBreakdown {
  model: string;
  total_tokens: number;
  daily: DailyModelTokens[];
}

export interface ProviderDailyTokens {
  provider: string;
  total_tokens: number;
  models: ModelBreakdown[];
}

function isCustomModel(model: string): boolean {
  return model.startsWith('custom:');
}

@Injectable()
export class PublicStatsService {
  private readonly dialect: DbDialect;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly dataSource: DataSource,
  ) {
    this.dialect = detectDialect(this.dataSource.options.type as string);
  }

  async getUsageStats(): Promise<UsageStats> {
    const cutoff7d = computeCutoff('7 days');
    const cutoff14d = computeCutoff('14 days');
    const cutoff30d = computeCutoff('30 days');

    const [countRow, topRows, tokenRows, tokenRowsPrev7d, tokenRows30d] = await Promise.all([
      this.messageRepo.createQueryBuilder('at').select('COUNT(*)', 'total').getRawOne(),
      this.messageRepo
        .createQueryBuilder('at')
        .select('at.model', 'model')
        .addSelect('COUNT(*)', 'usage_count')
        .where('at.model IS NOT NULL')
        .groupBy('at.model')
        .orderBy('usage_count', 'DESC')
        .getRawMany(),
      this.messageRepo
        .createQueryBuilder('at')
        .select('at.model', 'model')
        .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
        .where('at.model IS NOT NULL')
        .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff7d })
        .groupBy('at.model')
        .getRawMany(),
      this.messageRepo
        .createQueryBuilder('at')
        .select('at.model', 'model')
        .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
        .where('at.model IS NOT NULL')
        .andWhere('at.timestamp >= :cutoff14d', { cutoff14d })
        .andWhere('at.timestamp < :cutoff7d', { cutoff7d })
        .groupBy('at.model')
        .getRawMany(),
      this.messageRepo
        .createQueryBuilder('at')
        .select('at.model', 'model')
        .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
        .where('at.model IS NOT NULL')
        .andWhere('at.timestamp >= :cutoff30d', { cutoff30d })
        .groupBy('at.model')
        .getRawMany(),
    ]);

    const tokenMap = new Map<string, number>();
    for (const r of tokenRows) {
      tokenMap.set(r.model as string, Number(r.tokens ?? 0));
    }

    const tokenMapPrev7d = new Map<string, number>();
    for (const r of tokenRowsPrev7d) {
      tokenMapPrev7d.set(r.model as string, Number(r.tokens ?? 0));
    }

    const tokenMap30d = new Map<string, number>();
    for (const r of tokenRows30d) {
      tokenMap30d.set(r.model as string, Number(r.tokens ?? 0));
    }

    const eligible: TopModel[] = [];
    for (const r of topRows) {
      const modelName = r.model as string;
      if (isCustomModel(modelName)) continue;
      const pricing = this.pricingCache.getByModel(modelName);
      const provider = pricing?.provider || 'Unknown';
      if (EXCLUDED_PROVIDERS.has(provider)) continue;

      eligible.push({
        model: modelName,
        provider,
        tokens_7d: tokenMap.get(modelName) ?? 0,
        tokens_previous_7d: tokenMapPrev7d.get(modelName) ?? 0,
        tokens_30d: tokenMap30d.get(modelName) ?? 0,
        input_price_per_million:
          pricing?.input_price_per_token != null
            ? Number(pricing.input_price_per_token) * 1_000_000
            : null,
        output_price_per_million:
          pricing?.output_price_per_token != null
            ? Number(pricing.output_price_per_token) * 1_000_000
            : null,
        usage_rank: 0,
      });
    }

    eligible.sort((a, b) => b.tokens_7d - a.tokens_7d);
    const topModels = eligible.slice(0, MAX_RESULTS);
    topModels.forEach((m, i) => (m.usage_rank = i + 1));

    return {
      total_messages: Number(countRow?.total ?? 0),
      top_models: topModels,
      token_map: tokenMap,
    };
  }

  async getProviderDailyTokens(): Promise<ProviderDailyTokens[]> {
    const cutoff30d = computeCutoff('30 days');
    const dateBucket = sqlDateBucket('at.timestamp', this.dialect);

    const rows: { model: string; date: string; tokens: string }[] = await this.messageRepo
      .createQueryBuilder('at')
      .select('at.model', 'model')
      .addSelect(dateBucket, 'date')
      .addSelect('SUM(at.input_tokens + at.output_tokens)', 'tokens')
      .where('at.model IS NOT NULL')
      .andWhere('at.timestamp >= :cutoff30d', { cutoff30d })
      .groupBy('at.model')
      .addGroupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const modelMap = new Map<
      string,
      { provider: string; total: number; daily: Map<string, number> }
    >();

    for (const r of rows) {
      const modelName = r.model;
      if (isCustomModel(modelName)) continue;
      const pricing = this.pricingCache.getByModel(modelName);
      const provider = pricing?.provider || 'Unknown';
      if (EXCLUDED_PROVIDERS.has(provider)) continue;

      let entry = modelMap.get(modelName);
      if (!entry) {
        entry = { provider, total: 0, daily: new Map() };
        modelMap.set(modelName, entry);
      }
      const tokens = Number(r.tokens ?? 0);
      entry.total += tokens;
      entry.daily.set(r.date, tokens);
    }

    const providerMap = new Map<string, { total: number; models: ModelBreakdown[] }>();

    for (const [modelName, entry] of modelMap) {
      let prov = providerMap.get(entry.provider);
      if (!prov) {
        prov = { total: 0, models: [] };
        providerMap.set(entry.provider, prov);
      }
      prov.total += entry.total;
      prov.models.push({
        model: modelName,
        total_tokens: entry.total,
        daily: Array.from(entry.daily.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, tokens]) => ({ date, tokens })),
      });
    }

    return Array.from(providerMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([provider, data]) => ({
        provider,
        total_tokens: data.total,
        models: data.models.sort((a, b) => b.total_tokens - a.total_tokens),
      }));
  }

  getFreeModels(tokenMap: Map<string, number>): FreeModel[] {
    return this.pricingCache
      .getAll()
      .filter((e) => {
        if ((e.input_price_per_token ?? 0) !== 0 || (e.output_price_per_token ?? 0) !== 0)
          return false;
        if (isCustomModel(e.model_name)) return false;
        const provider = e.provider || 'Unknown';
        if (EXCLUDED_PROVIDERS.has(provider)) return false;
        return (tokenMap.get(e.model_name) ?? 0) > 0;
      })
      .map((e) => ({
        model_name: e.model_name,
        provider: e.provider || 'Unknown',
        tokens_7d: tokenMap.get(e.model_name) ?? 0,
      }))
      .sort((a, b) => b.tokens_7d - a.tokens_7d)
      .slice(0, MAX_RESULTS);
  }
}
