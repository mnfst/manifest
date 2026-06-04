import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import type { DiscoveredModel } from './model-fetcher';

export interface ProviderModelRegistryEntry {
  id: string;
  supportedEndpoints?: readonly string[];
}

type ProviderModelRegistration = string | Pick<DiscoveredModel, 'id' | 'supportedEndpoints'>;
type CachedProviderModelRegistration = Pick<DiscoveredModel, 'id' | 'supportedEndpoints'>;

/**
 * Maintains an in-memory registry of model IDs confirmed to exist
 * via provider-native APIs. Populated opportunistically when users
 * connect providers and on startup from cached data.
 *
 * Used to filter out phantom models from OpenRouter fallback lists.
 */
@Injectable()
export class ProviderModelRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProviderModelRegistryService.name);
  private readonly registry = new Map<string, Map<string, ProviderModelRegistryEntry>>();

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.loadFromCache();
  }

  /**
   * Register model IDs confirmed via a provider's native API.
   * Merges with any existing confirmed models for that provider.
   */
  registerModels(providerId: string, models: ProviderModelRegistration[]): void {
    const key = providerId.toLowerCase();
    const existing = this.registry.get(key) ?? new Map<string, ProviderModelRegistryEntry>();
    for (const model of models) {
      const entry = this.toRegistryEntry(model);
      if (!entry) continue;

      const previous = existing.get(entry.id);
      existing.set(entry.id, {
        ...previous,
        ...entry,
        supportedEndpoints: entry.supportedEndpoints ?? previous?.supportedEndpoints,
      });
    }
    if (existing.size > 0) this.registry.set(key, existing);
  }

  /**
   * Get the set of confirmed model IDs for a provider.
   * Returns null if no native data has ever been recorded for this provider.
   */
  getConfirmedModels(providerId: string): ReadonlySet<string> | null {
    const models = this.registry.get(providerId.toLowerCase());
    return models ? new Set(models.keys()) : null;
  }

  /**
   * Check whether a specific model is confirmed for a provider.
   * Returns true if confirmed, false if not, or null if no data exists.
   */
  isModelConfirmed(providerId: string, modelId: string): boolean | null {
    const confirmed = this.registry.get(providerId.toLowerCase());
    if (!confirmed) return null;
    return confirmed.has(modelId.toLowerCase());
  }

  getModelMetadata(providerId: string, modelId: string): ProviderModelRegistryEntry | null {
    return this.registry.get(providerId.toLowerCase())?.get(modelId.toLowerCase()) ?? null;
  }

  /**
   * Populate the registry from existing user_providers.cached_models
   * data that was previously fetched from native APIs.
   */
  private async loadFromCache(): Promise<void> {
    try {
      const providers = await this.providerRepo
        .createQueryBuilder('p')
        .select(['p.provider', 'p.cached_models'])
        .where('p.cached_models IS NOT NULL')
        .getMany();

      let totalModels = 0;
      for (const p of providers) {
        if (!Array.isArray(p.cached_models)) continue;
        const cachedModels = p.cached_models as unknown[];
        const models = cachedModels.filter(
          (m): m is CachedProviderModelRegistration =>
            typeof m === 'object' &&
            m !== null &&
            'id' in m &&
            typeof (m as { id?: unknown }).id === 'string' &&
            (m as { id?: string }).id!.length > 0,
        );
        if (models.length > 0) {
          this.registerModels(p.provider, models);
          totalModels += models.length;
        }
      }

      const providerCount = this.registry.size;
      if (providerCount > 0) {
        this.logger.log(
          `Provider model registry loaded: ${providerCount} providers, ${totalModels} model entries`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to load provider model registry from cache: ${err}`);
    }
  }

  private toRegistryEntry(model: ProviderModelRegistration): ProviderModelRegistryEntry | null {
    const id = typeof model === 'string' ? model : model.id;
    if (typeof id !== 'string' || id.length === 0) return null;

    const supportedEndpoints = typeof model === 'string' ? undefined : model.supportedEndpoints;
    const endpoints =
      Array.isArray(supportedEndpoints) && supportedEndpoints.length > 0
        ? Array.from(
            new Set(
              supportedEndpoints.filter(
                (endpoint): endpoint is string =>
                  typeof endpoint === 'string' && endpoint.length > 0,
              ),
            ),
          )
        : undefined;

    return {
      id: id.toLowerCase(),
      ...(endpoints && endpoints.length > 0 ? { supportedEndpoints: endpoints } : {}),
    };
  }
}
