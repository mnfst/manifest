import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository, In } from 'typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { randomUUID } from 'crypto';
import { encrypt, decrypt, getEncryptionSecret } from '../common/utils/crypto.util';
import { expandProviderNames } from './provider-aliases';
import { TIERS } from './scorer/types';

const TIER_LABELS: Record<string, string> = {
  simple: 'Simple',
  standard: 'Standard',
  complex: 'Complex',
  reasoning: 'Reasoning',
};

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    private readonly autoAssign: TierAutoAssignService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly routingCache: RoutingCacheService,
  ) {}

  /* ── Providers ── */

  async getProviders(agentId: string): Promise<UserProvider[]> {
    const cached = this.routingCache.getProviders(agentId);
    if (cached) return cached;

    const providers = await this.providerRepo.find({ where: { agent_id: agentId } });
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

    // Check if the provider still has another active record (different auth type)
    const otherActive = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, is_active: true },
    });

    if (otherActive) {
      // Provider is still available via the other auth type — skip override clearing
      this.routingCache.invalidateAgent(agentId);
      return { notifications: [] };
    }

    // No active records left — clear overrides that use this provider's models
    const overrides = await this.tierRepo.find({
      where: { agent_id: agentId, override_model: Not(IsNull()) },
    });

    const invalidated: { tier: string; modelName: string }[] = [];
    for (const tier of overrides) {
      const pricing = this.pricingCache.getByModel(tier.override_model!);
      if (pricing && pricing.provider.toLowerCase() === provider.toLowerCase()) {
        invalidated.push({ tier: tier.tier, modelName: tier.override_model! });
        tier.override_model = null;
        tier.override_auth_type = null;
        tier.updated_at = new Date().toISOString();
        await this.tierRepo.save(tier);
      }
    }

    // Clean fallback models belonging to the disconnected provider
    const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    for (const tier of allTiers) {
      if (!tier.fallback_models || tier.fallback_models.length === 0) continue;
      const filtered = tier.fallback_models.filter((m) => {
        const p = this.pricingCache.getByModel(m);
        return !p || p.provider.toLowerCase() !== provider.toLowerCase();
      });
      if (filtered.length !== tier.fallback_models.length) {
        tier.fallback_models = filtered.length > 0 ? filtered : null;
        tier.updated_at = new Date().toISOString();
        await this.tierRepo.save(tier);
      }
    }

    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);

    // Build notification messages
    const notifications: string[] = [];
    for (const { tier, modelName } of invalidated) {
      const updated = await this.tierRepo.findOne({
        where: { agent_id: agentId, tier },
      });
      const newModel = updated?.auto_assigned_model ?? null;
      const tierLabel = TIER_LABELS[tier] ?? tier;
      const suffix = newModel
        ? `${tierLabel} is back to automatic mode (${newModel}).`
        : `${tierLabel} is back to automatic mode.`;
      notifications.push(`${modelName} is no longer available. ${suffix}`);
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
        override_auth_type: null,
        fallback_models: null,
        updated_at: new Date().toISOString(),
      },
    );
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }

  /* ── Override invalidation (for pricing sync) ── */

  async invalidateOverridesForRemovedModels(removedModels: string[]): Promise<void> {
    if (removedModels.length === 0) return;

    const removedSet = new Set(removedModels);

    const affected = await this.tierRepo.find({
      where: { override_model: In(removedModels) },
    });

    const agentIds = new Set<string>();
    for (const tier of affected) {
      this.logger.warn(
        `Clearing override ${tier.override_model} for agent ${tier.agent_id} tier ${tier.tier} (model removed)`,
      );
      tier.override_model = null;
      tier.override_auth_type = null;
      tier.updated_at = new Date().toISOString();
      await this.tierRepo.save(tier);
      agentIds.add(tier.agent_id);
    }

    // Also clean fallback models referencing removed models
    const allTiers = await this.tierRepo.find();
    for (const tier of allTiers) {
      if (!tier.fallback_models || tier.fallback_models.length === 0) continue;
      const filtered = tier.fallback_models.filter((m) => !removedSet.has(m));
      if (filtered.length !== tier.fallback_models.length) {
        tier.fallback_models = filtered.length > 0 ? filtered : null;
        tier.updated_at = new Date().toISOString();
        await this.tierRepo.save(tier);
        agentIds.add(tier.agent_id);
      }
    }

    if (agentIds.size === 0) return;

    for (const agentId of agentIds) {
      await this.autoAssign.recalculate(agentId);
      this.routingCache.invalidateAgent(agentId);
    }

    this.logger.log(
      `Invalidated ${affected.length} overrides for ${agentIds.size} agents (removed models: ${removedModels.join(', ')})`,
    );
  }

  /* ── Tier Assignments ── */

  async getTiers(agentId: string, userId?: string): Promise<TierAssignment[]> {
    const cached = this.routingCache.getTiers(agentId);
    if (cached) return cached;

    const rows = await this.tierRepo.find({ where: { agent_id: agentId } });

    if (rows.length === 0) {
      // Lazy init: create the 4 tier rows
      const created: TierAssignment[] = [];
      for (const tier of TIERS) {
        const record = Object.assign(new TierAssignment(), {
          id: randomUUID(),
          user_id: userId ?? '',
          agent_id: agentId,
          tier,
          override_model: null,
          override_auth_type: null,
          auto_assigned_model: null,
        });
        await this.tierRepo.insert(record);
        created.push(record);
      }

      // If agent has active providers, recalculate immediately
      const providers = await this.providerRepo.find({
        where: { agent_id: agentId, is_active: true },
      });
      if (providers.length > 0) {
        await this.autoAssign.recalculate(agentId);
        const result = await this.tierRepo.find({ where: { agent_id: agentId } });
        this.routingCache.setTiers(agentId, result);
        return result;
      }

      this.routingCache.setTiers(agentId, created);
      return created;
    }

    this.routingCache.setTiers(agentId, rows);
    return rows;
  }

  async setOverride(
    agentId: string,
    userId: string,
    tier: string,
    model: string,
    authType?: 'api_key' | 'subscription',
  ): Promise<TierAssignment> {
    const existing = await this.tierRepo.findOne({
      where: { agent_id: agentId, tier },
    });

    if (existing) {
      existing.override_model = model;
      existing.override_auth_type = authType ?? null;
      existing.updated_at = new Date().toISOString();
      await this.tierRepo.save(existing);
      this.routingCache.invalidateAgent(agentId);
      return existing;
    }

    const record: TierAssignment = Object.assign(new TierAssignment(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      tier,
      override_model: model,
      override_auth_type: authType ?? null,
      auto_assigned_model: null,
    });

    await this.tierRepo.insert(record);
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async clearOverride(agentId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({
      where: { agent_id: agentId, tier },
    });
    if (!existing) return;

    existing.override_model = null;
    existing.override_auth_type = null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  async resetAllOverrides(agentId: string): Promise<void> {
    await this.tierRepo.update(
      { agent_id: agentId },
      {
        override_model: null,
        override_auth_type: null,
        fallback_models: null,
        updated_at: new Date().toISOString(),
      },
    );
    this.routingCache.invalidateAgent(agentId);
  }

  /* ── Fallbacks ── */

  async getFallbacks(agentId: string, tier: string): Promise<string[]> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    return existing?.fallback_models ?? [];
  }

  async setFallbacks(agentId: string, tier: string, models: string[]): Promise<string[]> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (!existing) return [];
    existing.fallback_models = models.length > 0 ? models : null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
    return models;
  }

  async clearFallbacks(agentId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (!existing) return;
    existing.fallback_models = null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  /* ── Provider API key retrieval ── */

  async getProviderApiKey(
    agentId: string,
    provider: string,
    authType?: 'api_key' | 'subscription',
  ): Promise<string | null> {
    // Ollama runs locally — no API key needed
    if (provider.toLowerCase() === 'ollama') return '';

    const cached = this.routingCache.getApiKey(agentId, provider, authType);
    if (cached !== undefined) return cached;

    const result = await this.resolveProviderApiKey(agentId, provider, authType);
    this.routingCache.setApiKey(agentId, provider, result, authType);
    return result;
  }

  private async resolveProviderApiKey(
    agentId: string,
    provider: string,
    preferredAuthType?: 'api_key' | 'subscription',
  ): Promise<string | null> {
    // Custom providers: exact match on provider key, allow empty key for local endpoints
    if (provider.startsWith('custom:')) {
      const record = await this.providerRepo.findOne({
        where: { agent_id: agentId, provider, is_active: true },
      });
      if (!record) return null;
      if (!record.api_key_encrypted) return '';
      try {
        return decrypt(record.api_key_encrypted, getEncryptionSecret());
      } catch {
        this.logger.warn(`Failed to decrypt API key for custom provider ${provider}`);
        return null;
      }
    }

    const names = expandProviderNames([provider]);
    const records = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });

    const matches = records.filter((r) => names.has(r.provider.toLowerCase()));
    if (matches.length === 0) return null;

    // Sort preferred auth type first (default: api_key for backward compat)
    const preferred = preferredAuthType ?? 'api_key';
    const sorted = [...matches].sort((a, b) => {
      const aPref = a.auth_type === preferred ? 0 : 1;
      const bPref = b.auth_type === preferred ? 0 : 1;
      return aPref - bPref;
    });

    for (const match of sorted) {
      if (!match.api_key_encrypted) continue;
      try {
        return decrypt(match.api_key_encrypted, getEncryptionSecret());
      } catch {
        const label = match.auth_type === 'subscription' ? 'token' : 'API key';
        this.logger.warn(`Failed to decrypt ${label} for provider ${provider}`);
      }
    }

    return null;
  }

  /* ── Auth type lookup ── */

  async getAuthType(agentId: string, provider: string): Promise<'api_key' | 'subscription'> {
    const names = expandProviderNames([provider]);
    const records = await this.getProviders(agentId);
    const matches = records.filter((r) => r.is_active && names.has(r.provider.toLowerCase()));
    // Prefer subscription if both exist
    const subMatch = matches.find((r) => r.auth_type === 'subscription' && r.api_key_encrypted);
    if (subMatch) return 'subscription';
    return matches[0]?.auth_type ?? 'api_key';
  }

  /* ── Runtime helper ── */

  async getEffectiveModel(agentId: string, assignment: TierAssignment): Promise<string | null> {
    if (assignment.override_model !== null) {
      const pricing = this.pricingCache.getByModel(assignment.override_model);
      if (pricing) {
        const names = expandProviderNames([pricing.provider]);
        const records = await this.providerRepo.find({
          where: { agent_id: agentId, is_active: true },
        });
        const match = records.find((r) => names.has(r.provider.toLowerCase()));
        if (match) return assignment.override_model;
      }
      this.logger.warn(
        `Override ${assignment.override_model} falling through to auto ` +
          `for agent=${agentId} tier=${assignment.tier} ` +
          `(auto=${assignment.auto_assigned_model})`,
      );
    }

    if (assignment.auto_assigned_model === null) {
      this.logger.warn(`auto_assigned_model is null for agent=${agentId} tier=${assignment.tier}`);
    }

    return assignment.auto_assigned_model;
  }
}
