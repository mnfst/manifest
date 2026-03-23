import { Injectable } from '@nestjs/common';
import { ModelPricingCacheService } from './model-pricing-cache.service';
import { PricingSyncService } from '../database/pricing-sync.service';

@Injectable()
export class ModelPricesService {
  constructor(
    private readonly pricingCache: ModelPricingCacheService,
    private readonly pricingSync: PricingSyncService,
  ) {}

  async getAll() {
    const entries = this.pricingCache.getAll();
    const lastSyncedAt = this.pricingSync.getLastFetchedAt()?.toISOString() ?? null;

    return {
      models: entries.map((r) => ({
        model_name: r.model_name,
        provider: r.provider || 'Unknown',
        input_price_per_million:
          r.input_price_per_token != null ? Number(r.input_price_per_token) * 1_000_000 : null,
        output_price_per_million:
          r.output_price_per_token != null ? Number(r.output_price_per_token) * 1_000_000 : null,
        display_name: r.display_name || null,
        validated: r.validated,
      })),
      lastSyncedAt,
    };
  }

  async triggerSync() {
    const updated = await this.pricingSync.refreshCache();
    await this.pricingCache.reload();
    return { updated };
  }
}
