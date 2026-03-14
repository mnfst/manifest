import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { buildAliasMap, resolveModelName } from './model-name-normalizer';
import { PricingSyncService } from '../database/pricing-sync.service';
import { MANUAL_PRICING } from '../routing/model-discovery/manual-pricing-reference';

/**
 * Lightweight pricing entry used for cost calculation and provider detection.
 * No longer backed by a database table — reads from OpenRouter cache + manual ref.
 */
export interface PricingEntry {
  model_name: string;
  provider: string;
  input_price_per_token: number | null;
  output_price_per_token: number | null;
}

@Injectable()
export class ModelPricingCacheService implements OnModuleInit {
  private readonly logger = new Logger(ModelPricingCacheService.name);
  private readonly cache = new Map<string, PricingEntry>();
  private aliasMap = new Map<string, string>();

  constructor(private readonly pricingSync: PricingSyncService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.cache.clear();

    // Load from OpenRouter cache — all models under "OpenRouter" provider
    const orCache = this.pricingSync.getAll();
    for (const [name, entry] of orCache) {
      this.cache.set(name, {
        model_name: name,
        provider: 'OpenRouter',
        input_price_per_token: entry.input,
        output_price_per_token: entry.output,
      });
    }

    // Load from manual pricing reference (niche providers not in OpenRouter)
    for (const [name, pricing] of MANUAL_PRICING) {
      if (!this.cache.has(name)) {
        this.cache.set(name, {
          model_name: name,
          provider: pricing.provider,
          input_price_per_token: pricing.input,
          output_price_per_token: pricing.output,
        });
      }
    }

    this.aliasMap = buildAliasMap([...this.cache.keys()]);
    this.logger.log(`Loaded ${this.cache.size} pricing entries`);
  }

  getByModel(modelName: string): PricingEntry | undefined {
    const exact = this.cache.get(modelName);
    if (exact) return exact;

    const resolved = resolveModelName(modelName, this.aliasMap);
    if (resolved) return this.cache.get(resolved);

    return undefined;
  }

  getAll(): PricingEntry[] {
    return [...this.cache.values()];
  }
}
