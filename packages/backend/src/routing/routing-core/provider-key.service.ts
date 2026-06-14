import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthType } from 'manifest-shared';
import { UserProvider } from '../../entities/user-provider.entity';
import { AgentEnabledProvider } from '../../entities/agent-enabled-provider.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { CachedProviderKey, RoutingCacheService } from './routing-cache.service';
import { ProviderService } from './provider.service';
import { decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import {
  expandProviderNames,
  inferProviderFromModelName,
} from '../../common/utils/provider-aliases';
import { isManifestUsableProvider } from '../../common/utils/subscription-support';

/**
 * Sentinel id for the built-in Ollama tile. getProviderKeys() short-circuits
 * Ollama to a synthetic key without a DB lookup, so this id matches no
 * `user_providers` row — callers stamping `agent_messages.user_provider_id`
 * must treat it as "no persisted connection" (NULL) to avoid an FK violation.
 */
export const SYNTHETIC_OLLAMA_PROVIDER_ID = 'ollama';

@Injectable()
export class ProviderKeyService {
  private readonly logger = new Logger(ProviderKeyService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly routingCache: RoutingCacheService,
    private readonly providerService: ProviderService,
    @Optional()
    @InjectRepository(AgentEnabledProvider)
    private readonly enabledProviderRepo: Repository<AgentEnabledProvider> | null = null,
  ) {}

  /**
   * Returns the ordered list of API keys for (user, provider, authType),
   * optionally filtered to only those the given agent has access to.
   * Each entry's apiKey is decrypted; entries that fail to decrypt are
   * dropped silently. Local providers (Ollama) yield a single empty-key entry.
   */
  async getProviderKeys(
    userId: string,
    provider: string,
    authType?: AuthType,
    agentId?: string,
  ): Promise<CachedProviderKey[]> {
    if (provider.toLowerCase() === 'ollama') {
      return [
        {
          id: SYNTHETIC_OLLAMA_PROVIDER_ID,
          label: 'Default',
          priority: 0,
          apiKey: '',
          region: null,
        },
      ];
    }

    // Agent-scoped lookups (the proxy path) cache under an agent-qualified
    // key. invalidateAgent clears the agent segment; invalidateUser clears
    // every entry for the user, so both invalidation paths stay effective.
    const cached = this.routingCache.getProviderKeys(userId, provider, authType, agentId);
    if (cached !== undefined) return cached;

    const result = await this.resolveProviderKeys(userId, provider, authType, agentId);
    this.routingCache.setProviderKeys(userId, provider, result, authType, agentId);
    return result;
  }

  /** Returns the label of the first (default) key for the given provider+authType. */
  async getDefaultKeyLabel(
    userId: string,
    provider: string,
    authType?: AuthType,
    agentId?: string,
  ): Promise<string | undefined> {
    const keys = await this.getProviderKeys(userId, provider, authType, agentId);
    return keys[0]?.label;
  }

  /**
   * Selects the key for (user, provider, authType): the case-insensitive label
   * match when a label is given, else the first (priority-ordered) default key.
   * Returns null when no key resolves. getProviderApiKey/getProviderRegion are
   * thin projections of this — callers that also need the `user_providers` row
   * id (e.g. the proxy, to stamp `agent_messages.user_provider_id`) call it
   * directly so the id selected and the key forwarded can never diverge.
   */
  async selectProviderKey(
    userId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
    agentId?: string,
  ): Promise<CachedProviderKey | null> {
    const keys = await this.getProviderKeys(userId, provider, authType, agentId);
    if (keys.length === 0) return null;
    if (label) {
      const match = keys.find((k) => k.label.toLowerCase() === label.toLowerCase());
      if (match) return match;
    }
    return keys[0];
  }

  async getProviderApiKey(
    userId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
    agentId?: string,
  ): Promise<string | null> {
    const key = await this.selectProviderKey(userId, provider, authType, label, agentId);
    return key ? key.apiKey : null;
  }

  /**
   * Returns the `user_providers` row id of the selected key, for stamping
   * `agent_messages.user_provider_id` at proxy time. Returns null when no key
   * resolves OR when the selection is the synthetic Ollama tile (which has no
   * persisted row — stamping its id would violate the agent_messages FK).
   */
  async getProviderKeyId(
    userId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
    agentId?: string,
  ): Promise<string | null> {
    const key = await this.selectProviderKey(userId, provider, authType, label, agentId);
    if (!key || key.id === SYNTHETIC_OLLAMA_PROVIDER_ID) return null;
    return key.id;
  }

  async getAuthType(
    userId: string,
    provider: string,
    excludeAuthTypes?: Set<string>,
    agentId?: string,
  ): Promise<AuthType> {
    const names = expandProviderNames([provider]);
    const records = await this.filterProvidersForAgent(
      await this.providerService.getProviders(userId),
      agentId,
    );
    let matches = records.filter((r) => r.is_active && names.has(r.provider.toLowerCase()));
    // When the caller knows certain auth types already failed (e.g. during
    // fallback retries), filter them out so the alternate type is preferred.
    if (excludeAuthTypes && excludeAuthTypes.size > 0) {
      const filtered = matches.filter((r) => !excludeAuthTypes.has(r.auth_type));
      if (filtered.length > 0) matches = filtered;
    }
    // Local providers (Ollama, LM Studio) don't store a key — prefer them
    // explicitly before the key-based heuristics below so a local-only
    // record doesn't get overridden by a keyed record for a sibling alias.
    const localMatch = matches.find((r) => r.auth_type === 'local');
    if (localMatch) return 'local';
    // Prefer subscription if both exist and the subscription record has a usable key
    const subMatch = matches.find((r) => r.auth_type === 'subscription' && r.api_key_encrypted);
    if (subMatch) return 'subscription';
    // Fallback: prefer records that have a decryptable key (avoids returning
    // 'subscription' for a keyless record when an api_key record has a real key)
    const withKey = matches.find((r) => r.api_key_encrypted);
    return withKey?.auth_type ?? matches[0]?.auth_type ?? 'api_key';
  }

  async hasActiveProvider(userId: string, provider: string, agentId?: string): Promise<boolean> {
    const names = expandProviderNames([provider]);
    const records = await this.filterProvidersForAgent(
      await this.providerService.getProviders(userId),
      agentId,
    );
    return records.some((r) => r.is_active && names.has(r.provider.toLowerCase()));
  }

  async getProviderRegion(
    userId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
    agentId?: string,
  ): Promise<string | null> {
    const key = await this.selectProviderKey(userId, provider, authType, label, agentId);
    return key ? key.region : null;
  }

  async findProviderForModel(
    userId: string,
    model: string,
    agentId?: string,
  ): Promise<string | undefined> {
    const providers = await this.filterProvidersForAgent(
      await this.providerService.getProviders(userId),
      agentId,
    );
    for (const p of providers) {
      if (!p.cached_models) continue;
      if (p.cached_models.some((m) => m.id === model)) return p.provider;
    }
    return undefined;
  }

  private async resolveProviderKeys(
    userId: string,
    provider: string,
    preferredAuthType?: AuthType,
    agentId?: string,
  ): Promise<CachedProviderKey[]> {
    // Custom providers: exact match on provider key, allow empty key for local endpoints
    if (provider.startsWith('custom:')) {
      const records = await this.providerRepo.find({
        where: { user_id: userId, provider, is_active: true },
        // id tiebreaker keeps selection deterministic when keys share a priority,
        // so the key forwarded and the id stamped never resolve to different rows.
        order: { priority: 'ASC', id: 'ASC' },
      });
      return (await this.filterProvidersForAgent(records, agentId)).flatMap((record) =>
        this.decryptOne(record),
      );
    }

    const names = expandProviderNames([provider]);
    const records = await this.providerRepo.find({
      where: { user_id: userId, is_active: true },
      // id tiebreaker keeps selection deterministic when keys share a priority,
      // so the key forwarded and the id stamped never resolve to different rows.
      order: { priority: 'ASC', id: 'ASC' },
    });

    const scopedRecords = await this.filterProvidersForAgent(records, agentId);
    const matches = scopedRecords.filter(
      (r) => isManifestUsableProvider(r) && names.has(r.provider.toLowerCase()),
    );
    if (matches.length === 0) return [];

    // When a caller explicitly requests an auth type, do not fall through
    // to a different auth type record.
    const candidates = preferredAuthType
      ? matches.filter((m) => m.auth_type === preferredAuthType)
      : [...matches].sort((a, b) => {
          const aPref = a.auth_type === 'api_key' ? 0 : 1;
          const bPref = b.auth_type === 'api_key' ? 0 : 1;
          if (aPref !== bPref) return aPref - bPref;
          return a.priority - b.priority;
        });

    return candidates.flatMap((record) => this.decryptOne(record));
  }

  private decryptOne(record: UserProvider): CachedProviderKey[] {
    if (!record.api_key_encrypted) {
      // Local providers (auth_type='local') legitimately have no key — surface
      // an empty string so callers treat the provider as "available". Other
      // keyless records (e.g. a subscription row pre-staged before OAuth
      // completes) should not be returned as resolvable.
      if (record.auth_type === 'local') {
        return [
          {
            id: record.id,
            label: record.label,
            priority: record.priority,
            apiKey: '',
            region: record.region,
          },
        ];
      }
      // Custom providers without a key (local-style endpoints) are also valid.
      if (record.provider.startsWith('custom:')) {
        return [
          {
            id: record.id,
            label: record.label,
            priority: record.priority,
            apiKey: '',
            region: record.region,
          },
        ];
      }
      return [];
    }
    try {
      return [
        {
          id: record.id,
          label: record.label,
          priority: record.priority,
          apiKey: decrypt(record.api_key_encrypted, getEncryptionSecret()),
          region: record.region,
        },
      ];
    } catch {
      const credentialLabel = record.auth_type === 'subscription' ? 'token' : 'API key';
      this.logger.warn(`Failed to decrypt ${credentialLabel} for provider ${record.provider}`);
      return [];
    }
  }

  async isModelAvailable(userId: string, model: string, agentId?: string): Promise<boolean> {
    // Check discovered models first.
    const discovered = await this.discoveryService.getModelForAgent(userId, model, agentId);
    if (discovered) return true;

    const pricing = this.pricingCache.getByModel(model);
    const inferredPrefix = inferProviderFromModelName(model);
    const pricingNames = pricing ? expandProviderNames([pricing.provider]) : null;
    const inferredNames = inferredPrefix ? expandProviderNames([inferredPrefix]) : null;

    // Qwen model ids must come from the provider's native discovery list.
    // Pricing/OpenRouter aliases are not reliable enough to treat as runnable DashScope ids.
    if (pricingNames?.has('qwen') || inferredNames?.has('qwen')) {
      return false;
    }

    const records = (
      await this.filterProvidersForAgent(
        await this.providerRepo.find({
          where: { user_id: userId, is_active: true },
        }),
        agentId,
      )
    ).filter(isManifestUsableProvider);
    if (pricing) {
      const names = expandProviderNames([pricing.provider]);
      if (records.find((r) => names.has(r.provider.toLowerCase()))) return true;
      const canonicalPrefix = inferProviderFromModelName(pricing.model_name);
      if (canonicalPrefix) {
        const cpNames = expandProviderNames([canonicalPrefix]);
        if (records.find((r) => cpNames.has(r.provider.toLowerCase()))) return true;
      }
    }
    if (inferredPrefix) {
      const prefixNames = expandProviderNames([inferredPrefix]);
      if (records.find((r) => prefixNames.has(r.provider.toLowerCase()))) return true;
    }
    return false;
  }

  /**
   * Filters a list of global user providers down to only those the given
   * agent has enabled. If no agentId is provided, or if the
   * enabled-provider repo is not available, returns the full list unchanged.
   */
  private async filterProvidersForAgent(
    providers: UserProvider[],
    agentId?: string,
  ): Promise<UserProvider[]> {
    if (!agentId || !this.enabledProviderRepo) return providers;
    const rows = await this.enabledProviderRepo.find({ where: { agent_id: agentId } });
    if (rows.length === 0) return [];
    const enabledIds = new Set(rows.map((r) => r.user_provider_id));
    return providers.filter((p) => enabledIds.has(p.id));
  }
}
