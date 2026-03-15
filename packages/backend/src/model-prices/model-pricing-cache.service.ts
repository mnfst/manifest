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

/**
 * OpenRouter vendor prefixes → display names for providers we support in routing.
 * Models from these vendors are extracted from OpenRouter data and attributed
 * to their native provider. Their canonical name (without prefix) is used as
 * the model_name. All other vendors are kept under "OpenRouter" with their
 * full vendor-prefixed ID.
 *
 * IMPORTANT: OpenRouter data is used ONLY as a pricing source. The model list
 * for each provider should come from the provider's own API via
 * ProviderModelFetcherService (used in model discovery). This cache is a
 * pricing reference for cost calculations, not the source of truth for
 * available models.
 */
const ROUTING_PROVIDER_PREFIXES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  mistralai: 'Mistral',
  moonshotai: 'Moonshot',
  qwen: 'Alibaba',
  alibaba: 'Alibaba',
  xai: 'xAI',
  'x-ai': 'xAI',
  minimax: 'MiniMax',
  'z-ai': 'Z.ai',
};

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
    const displayName = ROUTING_PROVIDER_PREFIXES[prefix];
    if (displayName) {
      return {
        provider: displayName,
        canonical: openRouterId.substring(slashIdx + 1),
      };
    }

    return { provider: 'OpenRouter', canonical: openRouterId };
  }
}
