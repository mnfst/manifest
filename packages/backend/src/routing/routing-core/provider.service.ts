import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository, In } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { randomUUID } from 'crypto';
import { encrypt, decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import {
  isManifestUsableProvider,
  isSupportedSubscriptionProvider,
} from '../../common/utils/subscription-support';
import { TIER_LABELS } from 'manifest-shared';
import { detectQwenRegion, isQwenRegion, isQwenResolvedRegion } from '../qwen-region';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    @InjectRepository(SpecificityAssignment)
    private readonly specificityRepo: Repository<SpecificityAssignment>,
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
    region?: string,
    accountLabel?: string,
  ): Promise<{ provider: UserProvider; isNew: boolean }> {
    const effectiveAuthType = authType ?? 'api_key';
    const effectiveLabel = accountLabel ?? 'default';

    // Try exact match by (agent, provider, auth_type, account_label) first.
    let existing = await this.providerRepo.findOne({
      where: {
        agent_id: agentId,
        provider,
        auth_type: effectiveAuthType,
        account_label: effectiveLabel,
      },
    });

    // Fallback: when no label was specified and the exact 'default' label
    // didn't match, look for a single active row for (provider, auth_type).
    // This supports token-refresh callers that don't carry the label.
    if (!existing && !accountLabel) {
      const activeRows = await this.providerRepo.find({
        where: { agent_id: agentId, provider, auth_type: effectiveAuthType, is_active: true },
      });
      if (activeRows.length === 1) {
        existing = activeRows[0];
      }
    }

    const resolvedRegion = await this.resolveProviderRegion(
      provider,
      effectiveAuthType,
      region,
      apiKey,
      existing,
    );
    const apiKeyEncrypted = apiKey ? encrypt(apiKey, getEncryptionSecret()) : null;
    const keyPrefix = apiKey ? apiKey.substring(0, 8) : null;

    if (existing) {
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
        existing.key_prefix = keyPrefix;
      }
      existing.region = resolvedRegion;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.providerRepo.save(existing);
      await this.afterProviderInsert(agentId);
      return { provider: existing, isNew: false };
    }

    // When creating a new row, check if any other active row for the same
    // (provider, auth_type) already exists so we can set is_default=false.
    const hasOtherActive = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: effectiveAuthType, is_active: true },
    });

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider,
      auth_type: effectiveAuthType,
      api_key_encrypted: apiKeyEncrypted,
      key_prefix: keyPrefix,
      region: resolvedRegion,
      is_active: true,
      account_label: effectiveLabel,
      is_default: !hasOtherActive,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.afterProviderInsert(agentId);
    return { provider: record, isNew: true };
  }

  private async resolveProviderRegion(
    provider: string,
    authType: 'api_key' | 'subscription',
    requestedRegion: string | undefined,
    apiKey: string | undefined,
    existing: UserProvider | null,
  ): Promise<string | null> {
    const lower = provider.toLowerCase();
    const isQwenProvider = lower === 'qwen' || lower === 'alibaba';
    if (!isQwenProvider || authType !== 'api_key') return null;

    if (requestedRegion === undefined) {
      if (apiKey) {
        return this.detectQwenRegionOrThrow(apiKey);
      }
      return isQwenResolvedRegion(existing?.region) ? existing.region : null;
    }

    if (!isQwenRegion(requestedRegion)) {
      throw new BadRequestException('Qwen region must be one of: auto, singapore, us, beijing');
    }

    if (requestedRegion !== 'auto') return requestedRegion;

    const keyToProbe = await this.getQwenDetectionKey(apiKey, existing);
    if (!keyToProbe) {
      return isQwenResolvedRegion(existing?.region) ? existing.region : null;
    }

    return this.detectQwenRegionOrThrow(keyToProbe);
  }

  private async getQwenDetectionKey(
    apiKey: string | undefined,
    existing: UserProvider | null,
  ): Promise<string | null> {
    if (apiKey) return apiKey;
    if (!existing?.api_key_encrypted) return null;

    try {
      return decrypt(existing.api_key_encrypted, getEncryptionSecret());
    } catch {
      this.logger.warn('Failed to decrypt API key while auto-detecting Alibaba region');
      return null;
    }
  }

  private async detectQwenRegionOrThrow(apiKey: string): Promise<string> {
    const detected = await detectQwenRegion(apiKey);
    if (detected) return detected;

    throw new BadRequestException(
      'Could not auto-detect Alibaba region from this API key. Verify the key and try again.',
    );
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
    await this.afterProviderInsert(agentId);
    return { isNew: true };
  }

  private async afterProviderInsert(agentId: string): Promise<void> {
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }

  async removeProvider(
    agentId: string,
    provider: string,
    authType?: 'api_key' | 'subscription',
    providerId?: string,
  ): Promise<{ notifications: string[] }> {
    const where: Record<string, unknown> = { agent_id: agentId, provider };
    if (authType) where.auth_type = authType;
    if (providerId) where.id = providerId;

    const existing = await this.providerRepo.findOne({ where });
    if (!existing) throw new NotFoundException('Provider not found');

    // Deactivate this record
    existing.is_active = false;
    existing.updated_at = new Date().toISOString();
    await this.providerRepo.save(existing);

    // Check if other active accounts of this provider still exist
    const otherActive = await this.providerRepo.find({
      where: { agent_id: agentId, provider, is_active: true },
    });

    if (otherActive.some((record) => isManifestUsableProvider(record))) {
      // Provider still available via other accounts — only clear overrides
      // that explicitly point to the removed account.
      const { invalidated } = await this.cleanupProviderReferences(
        agentId,
        [provider],
        existing.id,
      );
      await this.autoAssign.recalculate(agentId);
      this.routingCache.invalidateAgent(agentId);
      return this.buildNotifications(agentId, invalidated);
    }

    const { invalidated } = await this.cleanupProviderReferences(agentId, [provider]);
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
    return this.buildNotifications(agentId, invalidated);
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
        override_provider_id: null,
        override_auth_type: null,
        fallback_models: null,
        updated_at: new Date().toISOString(),
      },
    );
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }

  /** Update account_label and/or is_default on a specific provider row. */
  async updateProviderAccount(
    agentId: string,
    providerId: string,
    updates: { accountLabel?: string; isDefault?: boolean },
  ): Promise<UserProvider> {
    const record = await this.providerRepo.findOne({
      where: { id: providerId, agent_id: agentId, is_active: true },
    });
    if (!record) throw new NotFoundException('Provider account not found');

    if (updates.accountLabel !== undefined) {
      // Check for uniqueness conflict
      const conflict = await this.providerRepo.findOne({
        where: {
          agent_id: agentId,
          provider: record.provider,
          auth_type: record.auth_type,
          account_label: updates.accountLabel,
          is_active: true,
        },
      });
      if (conflict && conflict.id !== providerId) {
        throw new BadRequestException(
          `Account label "${updates.accountLabel}" already in use for ${record.provider}`,
        );
      }
      record.account_label = updates.accountLabel;
    }

    if (updates.isDefault === true) {
      // Clear is_default on sibling rows
      const siblings = await this.providerRepo.find({
        where: {
          agent_id: agentId,
          provider: record.provider,
          auth_type: record.auth_type,
          is_active: true,
        },
      });
      const toClear = siblings.filter((s) => s.is_default && s.id !== providerId);
      if (toClear.length > 0) {
        for (const s of toClear) {
          s.is_default = false;
          s.updated_at = new Date().toISOString();
        }
        await this.providerRepo.save(toClear);
      }
      record.is_default = true;
    } else if (updates.isDefault === false) {
      record.is_default = false;
    }

    record.updated_at = new Date().toISOString();
    await this.providerRepo.save(record);
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async updateProviderApiKeyById(
    agentId: string,
    providerId: string,
    apiKey: string,
    region?: string | null,
  ): Promise<UserProvider> {
    const record = await this.providerRepo.findOne({
      where: { id: providerId, agent_id: agentId, is_active: true },
    });
    if (!record) throw new NotFoundException('Provider account not found');

    record.api_key_encrypted = encrypt(apiKey, getEncryptionSecret());
    record.key_prefix = apiKey.substring(0, 8);
    if (region !== undefined) {
      record.region = region;
    }
    record.updated_at = new Date().toISOString();
    await this.providerRepo.save(record);
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  /** Build user-facing notification messages for invalidated tier overrides. */
  private async buildNotifications(
    agentId: string,
    invalidated: { tier: string; modelName: string }[],
  ): Promise<{ notifications: string[] }> {
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
        const tierLabel = TIER_LABELS[tier as keyof typeof TIER_LABELS] ?? tier;
        const suffix = newModel
          ? `${tierLabel} is back to automatic mode (${newModel}).`
          : `${tierLabel} is back to automatic mode.`;
        notifications.push(`${modelName} is no longer available. ${suffix}`);
      }
    }
    return { notifications };
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
      const { hadTierAssignments } = await this.cleanupProviderReferences(
        agentId,
        removedProviders,
      );
      if (hadTierAssignments) {
        await this.autoAssign.recalculate(agentId);
      }
    }
    this.routingCache.invalidateAgent(agentId);
  }

  /**
   * Clears overrides and fallback entries on both tier_assignments and
   * specificity_assignments that reference any of the given provider keys.
   *
   * When `removedProviderId` is set, only clear overrides whose
   * `override_provider_id` equals that ID. Overrides without an
   * `override_provider_id` (legacy rows) are still matched by provider
   * string heuristics — but only when `removedProviderId` is NOT set
   * (i.e. the whole provider is being removed).
   */
  private async cleanupProviderReferences(
    agentId: string,
    providers: string[],
    removedProviderId?: string,
  ): Promise<{ invalidated: { tier: string; modelName: string }[]; hadTierAssignments: boolean }> {
    if (providers.length === 0) return { invalidated: [], hadTierAssignments: false };

    const providerNames = new Set(providers.map((provider) => provider.toLowerCase()));
    const prefixKeys = providers.map((provider) => `${provider.toLowerCase()}/`);
    const modelBelongs = (model: string): boolean => {
      const lower = model.toLowerCase();
      if (prefixKeys.some((prefix) => lower.startsWith(prefix))) return true;
      const pricing = this.pricingCache.getByModel(model)?.provider.toLowerCase();
      return !!pricing && providerNames.has(pricing);
    };

    const invalidated: { tier: string; modelName: string }[] = [];

    const tierOverrides = await this.tierRepo.find({
      where: { agent_id: agentId, override_model: Not(IsNull()) },
    });
    const tiersToSave: TierAssignment[] = [];
    for (const tier of tierOverrides) {
      const overrideProvider = tier.override_provider?.toLowerCase();
      const overrideProviderId = tier.override_provider_id;

      // When a specific account was removed, only clear overrides pointing
      // to that exact account (by override_provider_id). Skip overrides
      // that point to a different account or have no provider_id.
      if (removedProviderId) {
        if (overrideProviderId === removedProviderId) {
          invalidated.push({ tier: tier.tier, modelName: tier.override_model! });
          tier.override_model = null;
          tier.override_provider = null;
          tier.override_provider_id = null;
          tier.override_auth_type = null;
          tier.updated_at = new Date().toISOString();
          tiersToSave.push(tier);
        }
        // Do NOT clear overrides that point to other accounts or have no provider_id.
        continue;
      }

      // Full provider removal — clear any override matching the provider string.
      if (
        (overrideProvider && providerNames.has(overrideProvider)) ||
        modelBelongs(tier.override_model!)
      ) {
        invalidated.push({ tier: tier.tier, modelName: tier.override_model! });
        tier.override_model = null;
        tier.override_provider = null;
        tier.override_provider_id = null;
        tier.override_auth_type = null;
        tier.updated_at = new Date().toISOString();
        tiersToSave.push(tier);
      }
    }

    const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    const hadTierAssignments = allTiers.length > 0;
    const savedTierIds = new Set(tiersToSave.map((tier) => tier.id));
    for (const tier of allTiers) {
      if (!tier.fallback_models || tier.fallback_models.length === 0) continue;
      const filtered = tier.fallback_models.filter((model) => !modelBelongs(model));
      if (filtered.length !== tier.fallback_models.length) {
        tier.fallback_models = filtered.length > 0 ? filtered : null;
        tier.updated_at = new Date().toISOString();
        if (!savedTierIds.has(tier.id)) tiersToSave.push(tier);
      }
    }

    if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

    const specificityRows = await this.specificityRepo.find({ where: { agent_id: agentId } });
    const specToSave: SpecificityAssignment[] = [];
    for (const row of specificityRows) {
      let changed = false;
      const overrideProvider = row.override_provider?.toLowerCase();
      const overrideProviderId = row.override_provider_id;

      if (removedProviderId) {
        // Account-scoped removal: only clear overrides pointing to this account.
        if (overrideProviderId === removedProviderId) {
          row.override_model = null;
          row.override_provider = null;
          row.override_provider_id = null;
          row.override_auth_type = null;
          changed = true;
        }
      } else if (
        row.override_model !== null &&
        ((overrideProvider && providerNames.has(overrideProvider)) ||
          modelBelongs(row.override_model))
      ) {
        // Full provider removal.
        row.override_model = null;
        row.override_provider = null;
        row.override_provider_id = null;
        row.override_auth_type = null;
        changed = true;
      }
      if (row.fallback_models && row.fallback_models.length > 0) {
        const filtered = row.fallback_models.filter((model) => !modelBelongs(model));
        if (filtered.length !== row.fallback_models.length) {
          row.fallback_models = filtered.length > 0 ? filtered : null;
          changed = true;
        }
      }
      if (changed) {
        row.updated_at = new Date().toISOString();
        specToSave.push(row);
      }
    }
    if (specToSave.length > 0) await this.specificityRepo.save(specToSave);

    return { invalidated, hadTierAssignments };
  }
}
