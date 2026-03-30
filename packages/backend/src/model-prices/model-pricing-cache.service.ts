import { Injectable, Logger, OnApplicationBootstrap, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { buildAliasMap, resolveModelName } from './model-name-normalizer';
import { PricingSyncService } from '../database/pricing-sync.service';
import { ModelsDevSyncService } from '../database/models-dev-sync.service';
import {
  OPENROUTER_PREFIX_TO_PROVIDER,
  PROVIDER_BY_ID,
  PROVIDER_BY_ID_OR_ALIAS,
} from '../common/constants/providers';
import { ProviderModelRegistryService } from '../model-discovery/provider-model-registry.service';

/**
 * Lightweight pricing entry used for cost calculation and provider detection.
 * Reads from models.dev (preferred) and OpenRouter cache (fallback).
 */
export interface PricingEntry {
  model_name: string;
  provider: string;
  input_price_per_token: number | null;
  output_price_per_token: number | null;
  display_name: string | null;
  /** True if confirmed via provider-native API, false if unverified, undefined if no data. */
  validated?: boolean;
  /** Data source: models.dev (curated, native IDs) or openrouter (broad coverage). */
  source?: 'models.dev' | 'openrouter';
}

@Injectable()
export class ModelPricingCacheService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModelPricingCacheService.name);
  private readonly cache = new Map<string, PricingEntry>();
  private aliasMap = new Map<string, string>();

  constructor(
    private readonly pricingSync: PricingSyncService,
    @Optional()
    @Inject(ModelsDevSyncService)
    private readonly modelsDevSync: ModelsDevSyncService | null,
    @Optional()
    @Inject(ProviderModelRegistryService)
    private readonly modelRegistry: ProviderModelRegistryService | null,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  /** Rebuild the pricing cache after sync services refresh their data. */
  @Cron('0 5 * * *')
  async scheduledReload(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.cache.clear();

    // Load OpenRouter data first (broad coverage, will be overridden by models.dev)
    const orCache = this.pricingSync.getAll();
    for (const [fullId, entry] of orCache) {
      const { provider, canonical, providerId } = this.resolveProviderAndName(fullId);

      const pricingEntry: PricingEntry = {
        model_name: fullId,
        provider,
        input_price_per_token: entry.input,
        output_price_per_token: entry.output,
        display_name: entry.displayName ?? null,
        validated: this.resolveValidated(providerId, canonical),
        source: 'openrouter',
      };

      // Store under full OpenRouter ID (e.g. "anthropic/claude-opus-4-6")
      this.cache.set(fullId, pricingEntry);

      // For supported providers, also store under canonical name (e.g. "claude-opus-4-6")
      // so cost lookups work when ingested messages use bare model names
      if (canonical !== fullId && !this.cache.has(canonical)) {
        this.cache.set(canonical, pricingEntry);
      }
    }

    // Overlay models.dev entries (curated, native IDs — preferred source)
    this.loadModelsDevEntries();

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
    const providerDisplayName = OPENROUTER_PREFIX_TO_PROVIDER.get(prefix);
    if (providerDisplayName) {
      return {
        provider: providerDisplayName,
        canonical: openRouterId.substring(slashIdx + 1),
        providerId: prefix,
      };
    }

    return { provider: 'OpenRouter', canonical: openRouterId, providerId: null };
  }

  /**
   * Load models.dev entries into the cache, overriding OpenRouter entries
   * for the same model. models.dev uses native provider IDs so bare model
   * names match directly without prefix stripping.
   */
  private loadModelsDevEntries(): void {
    if (!this.modelsDevSync) return;

    let count = 0;
    for (const [providerId, registryEntry] of PROVIDER_BY_ID) {
      const models = this.modelsDevSync.getModelsForProvider(providerId);
      for (const model of models) {
        if (model.inputPricePerToken === null) continue;

        const pricingEntry: PricingEntry = {
          model_name: model.id,
          provider: registryEntry.displayName,
          input_price_per_token: model.inputPricePerToken,
          output_price_per_token: model.outputPricePerToken,
          display_name: model.name || null,
          validated: this.resolveValidatedForModelsDev(providerId, model.id),
          source: 'models.dev',
        };

        // Override both bare and prefixed keys so getAll() dedup works.
        // Don't overwrite real pricing with zero-pricing entries (e.g. Copilot
        // lists models like gemini-2.5-pro as free, which would erase Google's
        // actual pricing that was set by an earlier provider in the loop).
        const existing = this.cache.get(model.id);
        const hasRealPricing = existing && (existing.input_price_per_token ?? 0) > 0;
        const isZeroPricing =
          (model.inputPricePerToken ?? 0) === 0 && (model.outputPricePerToken ?? 0) === 0;
        if (!hasRealPricing || !isZeroPricing) {
          this.cache.set(model.id, pricingEntry);
        }
        // Also update the OpenRouter-prefixed key if it exists
        for (const prefix of registryEntry.openRouterPrefixes) {
          const prefixedKey = `${prefix}/${model.id}`;
          if (this.cache.has(prefixedKey)) {
            this.cache.set(prefixedKey, { ...pricingEntry, model_name: prefixedKey });
          }
        }
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`Overlaid ${count} models.dev pricing entries`);
    }
  }

  private resolveValidated(providerId: string | null, canonical: string): boolean | undefined {
    if (!this.modelRegistry || !providerId) return undefined;
    // Resolve OpenRouter prefix to canonical provider ID (e.g., "google" → "gemini")
    const entry = PROVIDER_BY_ID_OR_ALIAS.get(providerId);
    const canonicalProviderId = entry?.id ?? providerId;
    const result = this.modelRegistry.isModelConfirmed(canonicalProviderId, canonical);
    return result ?? undefined;
  }

  private resolveValidatedForModelsDev(providerId: string, modelId: string): boolean | undefined {
    if (!this.modelRegistry) return undefined;
    const result = this.modelRegistry.isModelConfirmed(providerId, modelId);
    return result ?? undefined;
  }
}
