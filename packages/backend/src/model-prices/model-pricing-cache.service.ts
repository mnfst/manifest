import { Injectable, Logger, OnApplicationBootstrap, Inject, Optional } from '@nestjs/common';
import { buildAliasMap, resolveModelName } from './model-name-normalizer';
import { PricingSyncService } from '../database/pricing-sync.service';
import { OPENROUTER_PREFIX_TO_PROVIDER } from '../common/constants/providers';
import { ProviderModelRegistryService } from '../routing/model-discovery/provider-model-registry.service';

/**
 * Lightweight pricing entry used for cost calculation and provider detection.
 * No longer backed by a database table — reads from OpenRouter cache + manual ref.
 */
export interface PricingEntry {
  model_name: string;
  provider: string;
  input_price_per_token: number | null;
  output_price_per_token: number | null;
  display_name: string | null;
  /** True if confirmed via provider-native API, false if unverified, undefined if no data. */
  validated?: boolean;
}

@Injectable()
export class ModelPricingCacheService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModelPricingCacheService.name);
  private readonly cache = new Map<string, PricingEntry>();
  private aliasMap = new Map<string, string>();

  constructor(
    private readonly pricingSync: PricingSyncService,
    @Optional()
    @Inject(ProviderModelRegistryService)
    private readonly modelRegistry: ProviderModelRegistryService | null,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.cache.clear();

    const orCache = this.pricingSync.getAll();
    for (const [fullId, entry] of orCache) {
      const { provider, canonical, providerId } = this.resolveProviderAndName(fullId);

      const displayName = entry.displayName ?? null;
      const validated = this.resolveValidated(providerId, canonical);

      // Store under full OpenRouter ID (e.g. "anthropic/claude-opus-4-6")
      this.cache.set(fullId, {
        model_name: fullId,
        provider,
        input_price_per_token: entry.input,
        output_price_per_token: entry.output,
        display_name: displayName,
        validated,
      });

      // For supported providers, also store under canonical name (e.g. "claude-opus-4-6")
      // so cost lookups work when telemetry sends bare model names
      if (canonical !== fullId && !this.cache.has(canonical)) {
        this.cache.set(canonical, {
          model_name: fullId,
          provider,
          input_price_per_token: entry.input,
          output_price_per_token: entry.output,
          display_name: displayName,
          validated,
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
    // Deduplicate: canonical aliases point to the same model_name,
    // so filter to unique model_name values.
    const seen = new Set<string>();
    const result: PricingEntry[] = [];
    for (const entry of this.cache.values()) {
      if (!seen.has(entry.model_name)) {
        seen.add(entry.model_name);
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * For supported routing providers (OpenAI, Anthropic, etc.), extract
   * the provider display name and canonical model name from the OpenRouter ID.
   * All other vendors stay under "OpenRouter" with the full ID as canonical.
   * Also returns the raw prefix as `providerId` for registry lookups.
   */
  private resolveProviderAndName(openRouterId: string): {
    provider: string;
    canonical: string;
    providerId: string | null;
  } {
    if (openRouterId.startsWith('openrouter/')) {
      return { provider: 'OpenRouter', canonical: openRouterId, providerId: null };
    }

    const slashIdx = openRouterId.indexOf('/');
    if (slashIdx <= 0) {
      return { provider: 'OpenRouter', canonical: openRouterId, providerId: null };
    }

    const prefix = openRouterId.substring(0, slashIdx);
    const displayName = OPENROUTER_PREFIX_TO_PROVIDER.get(prefix);
    if (displayName) {
      return {
        provider: displayName,
        canonical: openRouterId.substring(slashIdx + 1),
        providerId: prefix,
      };
    }

    return { provider: 'OpenRouter', canonical: openRouterId, providerId: null };
  }

  private resolveValidated(providerId: string | null, canonical: string): boolean | undefined {
    if (!this.modelRegistry || !providerId) return undefined;
    const result = this.modelRegistry.isModelConfirmed(providerId, canonical);
    return result ?? undefined;
  }
}
