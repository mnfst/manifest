import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { computeCutoff } from '../common/utils/sql-dialect';

const MAX_RESULTS = 10;
const EXCLUDED_PROVIDERS = new Set(['Unknown', 'OpenRouter']);

export interface TopModel {
  model: string;
  provider: string;
  tokens_7d: number;
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

function isCustomModel(model: string): boolean {
  return model.startsWith('custom:');
}

@Injectable()
export class PublicStatsService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async getUsageStats(): Promise<UsageStats> {
    const cutoff = computeCutoff('7 days');

    const [countRow, topRows, tokenRows] = await Promise.all([
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
        .andWhere('at.timestamp >= :cutoff', { cutoff })
        .groupBy('at.model')
        .getRawMany(),
    ]);

    const tokenMap = new Map<string, number>();
    for (const r of tokenRows) {
      tokenMap.set(r.model as string, Number(r.tokens ?? 0));
    }

    const enriched: TopModel[] = [];
    for (const r of topRows) {
      if (enriched.length >= MAX_RESULTS) break;
      const modelName = r.model as string;
      if (isCustomModel(modelName)) continue;
      const pricing = this.pricingCache.getByModel(modelName);
      const provider = pricing?.provider || 'Unknown';
      if (EXCLUDED_PROVIDERS.has(provider)) continue;

      enriched.push({
        model: modelName,
        provider,
        tokens_7d: tokenMap.get(modelName) ?? 0,
        input_price_per_million:
          pricing?.input_price_per_token != null
            ? Number(pricing.input_price_per_token) * 1_000_000
            : null,
        output_price_per_million:
          pricing?.output_price_per_token != null
            ? Number(pricing.output_price_per_token) * 1_000_000
            : null,
        usage_rank: enriched.length + 1,
      });
    }

    enriched.sort((a, b) => b.tokens_7d - a.tokens_7d);
    enriched.forEach((m, i) => (m.usage_rank = i + 1));

    return {
      total_messages: Number(countRow?.total ?? 0),
      top_models: enriched,
      token_map: tokenMap,
    };
  }

  getFreeModels(tokenMap: Map<string, number>): FreeModel[] {
    return this.pricingCache
      .getAll()
      .filter((e) => {
        if ((e.input_price_per_token ?? 0) !== 0 || (e.output_price_per_token ?? 0) !== 0)
          return false;
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
