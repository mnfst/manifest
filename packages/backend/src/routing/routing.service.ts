import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository, In } from 'typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
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
  ) {}

  /* ── Providers ── */

  async getProviders(userId: string): Promise<UserProvider[]> {
    return this.providerRepo.find({ where: { user_id: userId } });
  }

  async upsertProvider(
    userId: string,
    provider: string,
    apiKey?: string,
  ): Promise<{ provider: UserProvider; isNew: boolean }> {
    const apiKeyEncrypted = apiKey
      ? encrypt(apiKey, getEncryptionSecret())
      : null;

    const existing = await this.providerRepo.findOne({
      where: { user_id: userId, provider },
    });

    if (existing) {
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
      }
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.providerRepo.save(existing);
      await this.autoAssign.recalculate(userId);
      return { provider: existing, isNew: false };
    }

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      provider,
      api_key_encrypted: apiKeyEncrypted,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.autoAssign.recalculate(userId);
    return { provider: record, isNew: true };
  }

  async removeProvider(
    userId: string,
    provider: string,
  ): Promise<{ notifications: string[] }> {
    const existing = await this.providerRepo.findOne({
      where: { user_id: userId, provider },
    });
    if (!existing) throw new NotFoundException('Provider not found');

    // Find overrides that belong to this provider
    const overrides = await this.tierRepo.find({
      where: { user_id: userId, override_model: Not(IsNull()) },
    });

    const invalidated: { tier: string; modelName: string }[] = [];
    for (const tier of overrides) {
      const pricing = this.pricingCache.getByModel(tier.override_model!);
      if (pricing && pricing.provider.toLowerCase() === provider.toLowerCase()) {
        invalidated.push({ tier: tier.tier, modelName: tier.override_model! });
        tier.override_model = null;
        tier.updated_at = new Date().toISOString();
        await this.tierRepo.save(tier);
      }
    }

    // Deactivate provider and recalculate
    existing.is_active = false;
    existing.updated_at = new Date().toISOString();
    await this.providerRepo.save(existing);
    await this.autoAssign.recalculate(userId);

    // Build notification messages
    const notifications: string[] = [];
    for (const { tier, modelName } of invalidated) {
      const updated = await this.tierRepo.findOne({
        where: { user_id: userId, tier },
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

  async deactivateAllProviders(userId: string): Promise<void> {
    await this.providerRepo.update(
      { user_id: userId },
      { is_active: false, updated_at: new Date().toISOString() },
    );
    await this.tierRepo.update(
      { user_id: userId },
      { override_model: null, updated_at: new Date().toISOString() },
    );
    await this.autoAssign.recalculate(userId);
  }

  /* ── Override invalidation (for pricing sync) ── */

  async invalidateOverridesForRemovedModels(
    removedModels: string[],
  ): Promise<void> {
    if (removedModels.length === 0) return;

    const affected = await this.tierRepo.find({
      where: { override_model: In(removedModels) },
    });

    if (affected.length === 0) return;

    const userIds = new Set<string>();
    for (const tier of affected) {
      this.logger.warn(
        `Clearing override ${tier.override_model} for user ${tier.user_id} tier ${tier.tier} (model removed)`,
      );
      tier.override_model = null;
      tier.updated_at = new Date().toISOString();
      await this.tierRepo.save(tier);
      userIds.add(tier.user_id);
    }

    for (const userId of userIds) {
      await this.autoAssign.recalculate(userId);
    }

    this.logger.log(
      `Invalidated ${affected.length} overrides for ${userIds.size} users (removed models: ${removedModels.join(', ')})`,
    );
  }

  /* ── Tier Assignments ── */

  async getTiers(userId: string): Promise<TierAssignment[]> {
    const rows = await this.tierRepo.find({ where: { user_id: userId } });

    if (rows.length === 0) {
      // Lazy init: create the 4 tier rows
      const created: TierAssignment[] = [];
      for (const tier of TIERS) {
        const record = Object.assign(new TierAssignment(), {
          id: randomUUID(),
          user_id: userId,
          tier,
          override_model: null,
          auto_assigned_model: null,
        });
        await this.tierRepo.insert(record);
        created.push(record);
      }

      // If user has active providers, recalculate immediately
      const providers = await this.providerRepo.find({
        where: { user_id: userId, is_active: true },
      });
      if (providers.length > 0) {
        await this.autoAssign.recalculate(userId);
        return this.tierRepo.find({ where: { user_id: userId } });
      }

      return created;
    }

    return rows;
  }

  async setOverride(
    userId: string,
    tier: string,
    model: string,
  ): Promise<TierAssignment> {
    const existing = await this.tierRepo.findOne({
      where: { user_id: userId, tier },
    });

    if (existing) {
      existing.override_model = model;
      existing.updated_at = new Date().toISOString();
      await this.tierRepo.save(existing);
      return existing;
    }

    const record: TierAssignment = Object.assign(new TierAssignment(), {
      id: randomUUID(),
      user_id: userId,
      tier,
      override_model: model,
      auto_assigned_model: null,
    });

    await this.tierRepo.insert(record);
    return record;
  }

  async clearOverride(userId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({
      where: { user_id: userId, tier },
    });
    if (!existing) return;

    existing.override_model = null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
  }

  async resetAllOverrides(userId: string): Promise<void> {
    await this.tierRepo.update(
      { user_id: userId },
      { override_model: null, updated_at: new Date().toISOString() },
    );
  }

  /* ── Provider API key retrieval ── */

  async getProviderApiKey(
    userId: string,
    provider: string,
  ): Promise<string | null> {
    // Ollama runs locally — no API key needed
    if (provider.toLowerCase() === 'ollama') return '';

    const names = expandProviderNames([provider]);
    const records = await this.providerRepo.find({
      where: { user_id: userId, is_active: true },
    });

    const match = records.find((r) => names.has(r.provider.toLowerCase()));
    if (!match?.api_key_encrypted) return null;

    try {
      return decrypt(match.api_key_encrypted, getEncryptionSecret());
    } catch {
      this.logger.warn(`Failed to decrypt API key for provider ${provider}`);
      return null;
    }
  }

  /* ── Key prefix extraction ── */

  getKeyPrefix(encryptedKey: string | null, length = 8): string | null {
    if (!encryptedKey) return null;
    try {
      const decrypted = decrypt(encryptedKey, getEncryptionSecret());
      return decrypted.substring(0, length);
    } catch {
      this.logger.warn('Failed to decrypt API key for prefix extraction');
      return null;
    }
  }

  /* ── Runtime helper ── */

  async getEffectiveModel(
    userId: string,
    assignment: TierAssignment,
  ): Promise<string | null> {
    if (assignment.override_model !== null) {
      // Belt-and-suspenders: verify the provider is still connected
      const pricing = this.pricingCache.getByModel(assignment.override_model);
      if (pricing) {
        const provider = await this.providerRepo.findOne({
          where: {
            user_id: userId,
            provider: pricing.provider.toLowerCase(),
            is_active: true,
          },
        });
        if (provider) return assignment.override_model;
      }
      // Provider disconnected or model unknown — fall through to auto
    }
    return assignment.auto_assigned_model;
  }
}
