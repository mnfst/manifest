import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository, In } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { randomUUID } from 'crypto';
import { encrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import {
  isManifestUsableProvider,
  isSupportedSubscriptionProvider,
} from '../../common/utils/subscription-support';

const TIER_LABELS: Record<string, string> = {
  simple: 'Simple',
  standard: 'Standard',
  complex: 'Complex',
  reasoning: 'Reasoning',
};

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    private readonly autoAssign: TierAutoAssignService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly routingCache: RoutingCacheService,
  ) {}

  /** Public entry point for tier recalculation (e.g. after model discovery). */
  async recalculateTiers(agentId: string): Promise<void> {
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }

  async getProviders(agentId: string): Promise<UserProvider[]> {
    const cached = this.routingCache.getProviders(agentId);
    if (cached) return cached;

    await this.cleanupUnsupportedSubscriptionProviders(agentId);
    const providers = (await this.providerRepo.find({ where: { agent_id: agentId } })).filter(
      isManifestUsableProvider,
    );
    this.routingCache.setProviders(agentId, providers);
    return providers;
  }

  async upsertProvider(
    agentId: string,
    userId: string,
    provider: string,
    apiKey?: string,
    authType?: 'api_key' | 'subscription',
  ): Promise<{ provider: UserProvider; isNew: boolean }> {
    const effectiveAuthType = authType ?? 'api_key';
    const apiKeyEncrypted = apiKey ? encrypt(apiKey, getEncryptionSecret()) : null;
    const keyPrefix = apiKey ? apiKey.substring(0, 8) : null;

    const existing = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: effectiveAuthType },
    });

    if (existing) {
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
        existing.key_prefix = keyPrefix;
      }
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.providerRepo.save(existing);
      await this.autoAssign.recalculate(agentId);
      this.routingCache.invalidateAgent(agentId);
      return { provider: existing, isNew: false };
    }

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider,
      auth_type: effectiveAuthType,
      api_key_encrypted: apiKeyEncrypted,
      key_prefix: keyPrefix,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
    return { provider: record, isNew: true };
  }

  async registerSubscriptionProvider(
    agentId: string,
    userId: string,
    provider: string,
  ): Promise<{ isNew: boolean }> {
    if (!isSupportedSubscriptionProvider(provider)) {
      this.logger.debug(`Ignoring unsupported subscription provider registration for ${provider}`);
      return { isNew: false };
    }

    const existing = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: 'subscription' },
    });

    if (existing) return { isNew: false };
    const hasApiKey = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: 'api_key', is_active: true },
    });
    if (hasApiKey) return { isNew: false };

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider,
      auth_type: 'subscription',
      api_key_encrypted: null,
      key_prefix: null,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
    return { isNew: true };
  }
  async removeProvider(
    agentId: string,
    provider: string,
    authType?: 'api_key' | 'subscription',
  ): Promise<{ notifications: string[] }> {
    const where: Record<string, unknown> = { agent_id: agentId, provider };
    if (authType) where.auth_type = authType;

    const existing = await this.providerRepo.findOne({ where });
    if (!existing) throw new NotFoundException('Provider not found');

    // Deactivate this record
    existing.is_active = false;
    existing.updated_at = new Date().toISOString();
    await this.providerRepo.save(existing);
    const otherActive = await this.providerRepo.find({
      where: { agent_id: agentId, provider, is_active: true },
    });

    if (otherActive.some((record) => isManifestUsableProvider(record))) {
      // Provider is still available via the other auth type — skip override clearing
      this.routingCache.invalidateAgent(agentId);
      return { notifications: [] };
    }

    const { invalidated } = await this.clearTierAssignmentsForProviders(agentId, [provider]);
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);

    const notifications: string[] = [];
    if (invalidated.length > 0) {
      const tierNames = invalidated.map((i) => i.tier);
      const updatedTiers = await this.tierRepo.find({
        where: { agent_id: agentId, tier: In(tierNames) },
      });
      const tierMap = new Map(updatedTiers.map((t) => [t.tier, t]));
      for (const { tier, modelName } of invalidated) {
        const updated = tierMap.get(tier);
        const newModel = updated?.auto_assigned_model ?? null;
        const tierLabel = TIER_LABELS[tier] ?? tier;
        const suffix = newModel
          ? `${tierLabel} is back to automatic mode (${newModel}).`
          : `${tierLabel} is back to automatic mode.`;
        notifications.push(`${modelName} is no longer available. ${suffix}`);
      }
    }

    return { notifications };
  }
  async deactivateAllProviders(agentId: string): Promise<void> {
    await this.providerRepo.update(
      { agent_id: agentId },
      { is_active: false, updated_at: new Date().toISOString() },
    );
    await this.tierRepo.update(
      { agent_id: agentId },
      {
        override_model: null,
        override_provider: null,
        override_auth_type: null,
        fallback_models: null,
        updated_at: new Date().toISOString(),
      },
    );
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }
  private async cleanupUnsupportedSubscriptionProviders(agentId: string): Promise<void> {
    const activeProviders = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });
    const unsupported = activeProviders.filter(
      (record) => record.auth_type === 'subscription' && !isManifestUsableProvider(record),
    );
    if (unsupported.length === 0) return;

    const now = new Date().toISOString();
    for (const record of unsupported) {
      record.is_active = false;
      record.updated_at = now;
    }
    await this.providerRepo.save(unsupported);

    const unsupportedIds = new Set(unsupported.map((record) => record.id));
    const remainingActive = activeProviders.filter((record) => !unsupportedIds.has(record.id));
    const usableProviders = remainingActive.filter(isManifestUsableProvider);

    const removedProviders = Array.from(
      new Set(
        unsupported
          .map((record) => record.provider)
          .filter(
            (provider) =>
              !usableProviders.some(
                (record) => record.provider.toLowerCase() === provider.toLowerCase(),
              ),
          ),
      ),
    );

    if (removedProviders.length > 0) {
      const { hadTierAssignments } = await this.clearTierAssignmentsForProviders(
        agentId,
        removedProviders,
      );
      if (hadTierAssignments) {
        await this.autoAssign.recalculate(agentId);
      }
    }
    this.routingCache.invalidateAgent(agentId);
  }
  private async clearTierAssignmentsForProviders(
    agentId: string,
    providers: string[],
  ): Promise<{ invalidated: { tier: string; modelName: string }[]; hadTierAssignments: boolean }> {
    if (providers.length === 0) return { invalidated: [], hadTierAssignments: false };

    const providerNames = new Set(providers.map((provider) => provider.toLowerCase()));
    const overrides = await this.tierRepo.find({
      where: { agent_id: agentId, override_model: Not(IsNull()) },
    });

    const invalidated: { tier: string; modelName: string }[] = [];
    const tiersToSave: TierAssignment[] = [];
    for (const tier of overrides) {
      const overrideProvider = tier.override_provider?.toLowerCase();
      const pricingProvider = this.pricingCache
        .getByModel(tier.override_model!)
        ?.provider.toLowerCase();
      if (
        (overrideProvider && providerNames.has(overrideProvider)) ||
        (pricingProvider && providerNames.has(pricingProvider))
      ) {
        invalidated.push({ tier: tier.tier, modelName: tier.override_model! });
        tier.override_model = null;
        tier.override_provider = null;
        tier.override_auth_type = null;
        tier.updated_at = new Date().toISOString();
        tiersToSave.push(tier);
      }
    }

    const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    const hadTierAssignments = allTiers.length > 0;
    const savedIds = new Set(tiersToSave.map((tier) => tier.id));
    for (const tier of allTiers) {
      if (!tier.fallback_models || tier.fallback_models.length === 0) continue;
      const filtered = tier.fallback_models.filter((model) => {
        const pricing = this.pricingCache.getByModel(model);
        return !pricing || !providerNames.has(pricing.provider.toLowerCase());
      });
      if (filtered.length !== tier.fallback_models.length) {
        tier.fallback_models = filtered.length > 0 ? filtered : null;
        tier.updated_at = new Date().toISOString();
        if (!savedIds.has(tier.id)) tiersToSave.push(tier);
      }
    }

    if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

    return { invalidated, hadTierAssignments };
  }
}
