import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { buildAliasMap, resolveModelName } from './model-name-normalizer';
import { PricingSyncService } from '../database/pricing-sync.service';
import { MANUAL_PRICING } from '../routing/model-discovery/manual-pricing-reference';
import { OPENROUTER_PREFIX_TO_PROVIDER } from '../common/constants/providers';

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

    const orCache = this.pricingSync.getAll();
    for (const [fullId, entry] of orCache) {
      const { provider, canonical } = this.resolveProviderAndName(fullId);

      // Store under full OpenRouter ID (e.g. "anthropic/claude-opus-4-6")
      this.cache.set(fullId, {
        model_name: fullId,
        provider,
        input_price_per_token: entry.input,
        output_price_per_token: entry.output,
      });

      // For supported providers, also store under canonical name (e.g. "claude-opus-4-6")
      // so cost lookups work when telemetry sends bare model names
      if (canonical !== fullId && !this.cache.has(canonical)) {
        this.cache.set(canonical, {
          model_name: fullId,
          provider,
          input_price_per_token: entry.input,
          output_price_per_token: entry.output,
        });
      }
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

  /**
   * For supported routing providers (OpenAI, Anthropic, etc.), extract
   * the provider display name and canonical model name from the OpenRouter ID.
   * All other vendors stay under "OpenRouter" with the full ID as canonical.
   */
  private resolveProviderAndName(openRouterId: string): {
    provider: string;
    canonical: string;
  } {
    if (openRouterId.startsWith('openrouter/')) {
      return { provider: 'OpenRouter', canonical: openRouterId };
    }

    const slashIdx = openRouterId.indexOf('/');
    if (slashIdx <= 0) {
      return { provider: 'OpenRouter', canonical: openRouterId };
    }

    const prefix = openRouterId.substring(0, slashIdx);
    const displayName = OPENROUTER_PREFIX_TO_PROVIDER.get(prefix);
    if (displayName) {
      return {
        provider: displayName,
        canonical: openRouterId.substring(slashIdx + 1),
      };
    }

    return { provider: 'OpenRouter', canonical: openRouterId };
  }
}
