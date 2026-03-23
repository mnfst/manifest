import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';

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
  private readonly registry = new Map<string, Set<string>>();

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
  registerModels(providerId: string, modelIds: string[]): void {
    const key = providerId.toLowerCase();
    const existing = this.registry.get(key);
    if (existing) {
      for (const id of modelIds) existing.add(id.toLowerCase());
    } else {
      this.registry.set(key, new Set(modelIds.map((id) => id.toLowerCase())));
    }
  }

  /**
   * Get the set of confirmed model IDs for a provider.
   * Returns null if no native data has ever been recorded for this provider.
   */
  getConfirmedModels(providerId: string): ReadonlySet<string> | null {
    return this.registry.get(providerId.toLowerCase()) ?? null;
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
        const ids = p.cached_models.map((m) => m.id).filter(Boolean);
        if (ids.length > 0) {
          this.registerModels(p.provider, ids);
          totalModels += ids.length;
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
}
