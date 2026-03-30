import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import {
  ModelPricingCacheService,
  PricingEntry,
} from '../model-prices/model-pricing-cache.service';

export interface TopModel {
  model: string;
  usage_count: number;
}

export interface UsageStats {
  total_messages: number;
  top_models: TopModel[];
}

export interface CatalogModel {
  model_name: string;
  provider: string;
  display_name: string | null;
  context_window: number | null;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  is_free: boolean;
  usage_rank: number | null;
}

@Injectable()
export class PublicStatsService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async getUsageStats(): Promise<UsageStats> {
    const [countRow, topRows] = await Promise.all([
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
    ]);

    return {
      total_messages: Number(countRow?.total ?? 0),
      top_models: topRows.map((r) => ({
        model: r.model as string,
        usage_count: Number(r.usage_count),
      })),
    };
  }

  getModelCatalog(rankMap: Map<string, number>): CatalogModel[] {
    const entries: PricingEntry[] = this.pricingCache.getAll();
    return entries.map((e) => ({
      model_name: e.model_name,
      provider: e.provider || 'Unknown',
      display_name: e.display_name || null,
      context_window: e.context_window ?? null,
      input_price_per_million:
        e.input_price_per_token != null ? Number(e.input_price_per_token) * 1_000_000 : null,
      output_price_per_million:
        e.output_price_per_token != null ? Number(e.output_price_per_token) * 1_000_000 : null,
      is_free: (e.input_price_per_token ?? 0) === 0 && (e.output_price_per_token ?? 0) === 0,
      usage_rank: rankMap.get(e.model_name) ?? null,
    }));
  }

  buildRankMap(topModels: TopModel[]): Map<string, number> {
    const map = new Map<string, number>();
    topModels.forEach((m, i) => map.set(m.model, i + 1));
    return map;
  }
}
