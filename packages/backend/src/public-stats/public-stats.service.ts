import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { computeCutoff } from '../common/utils/sql-dialect';

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
        .limit(20)
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

    const topModels: TopModel[] = topRows.map((r, i) => {
      const modelName = r.model as string;
      const pricing = this.pricingCache.getByModel(modelName);
      return {
        model: modelName,
        provider: pricing?.provider || 'Unknown',
        tokens_7d: tokenMap.get(modelName) ?? 0,
        input_price_per_million:
          pricing?.input_price_per_token != null
            ? Number(pricing.input_price_per_token) * 1_000_000
            : null,
        output_price_per_million:
          pricing?.output_price_per_token != null
            ? Number(pricing.output_price_per_token) * 1_000_000
            : null,
        usage_rank: i + 1,
      };
    });

    return {
      total_messages: Number(countRow?.total ?? 0),
      top_models: topModels,
      token_map: tokenMap,
    };
  }

  getFreeModels(tokenMap: Map<string, number>): FreeModel[] {
    return this.pricingCache
      .getAll()
      .filter((e) => (e.input_price_per_token ?? 0) === 0 && (e.output_price_per_token ?? 0) === 0)
      .map((e) => ({
        model_name: e.model_name,
        provider: e.provider || 'Unknown',
        tokens_7d: tokenMap.get(e.model_name) ?? 0,
      }));
  }
}
