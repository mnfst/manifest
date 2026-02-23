import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository, In } from 'typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { type Preset } from './tier-auto-assign.service';
import { expandProviderNames } from './provider-aliases';
import { randomUUID } from 'crypto';

const TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;

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
    apiKeyEncrypted: string,
  ): Promise<UserProvider> {
    const existing = await this.providerRepo.findOne({
      where: { user_id: userId, provider },
    });

    if (existing) {
      existing.api_key_encrypted = apiKeyEncrypted;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.providerRepo.save(existing);
      await this.autoAssign.recalculate(userId);
      return existing;
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
    return record;
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

  /* ── Bulk save ── */

  async bulkSaveTiers(
    userId: string,
    items: { tier: string; model: string | null }[],
    preset?: string,
    fromPreset?: string,
  ): Promise<TierAssignment[]> {
    const namedPresets = ['eco', 'balanced', 'quality', 'fast'];

    // Only snapshot override_model → custom_model when leaving Custom for a named preset
    if (preset && namedPresets.includes(preset) && fromPreset === 'custom') {
      const currentTiers = await this.tierRepo.find({
        where: { user_id: userId },
      });
      for (const tier of currentTiers) {
        if (tier.override_model !== null) {
          tier.custom_model = tier.override_model;
          tier.updated_at = new Date().toISOString();
          await this.tierRepo.save(tier);
        }
      }
    }

    for (const item of items) {
      if (item.model !== null) {
        await this.setOverride(userId, item.tier, item.model);
      } else {
        await this.clearOverride(userId, item.tier);
      }
    }

    // When saving Custom, sync custom_model to match the new overrides
    if (preset === 'custom') {
      const updatedTiers = await this.tierRepo.find({
        where: { user_id: userId },
      });
      for (const tier of updatedTiers) {
        tier.custom_model = tier.override_model;
        tier.updated_at = new Date().toISOString();
        await this.tierRepo.save(tier);
      }
    }

    await this.autoAssign.recalculate(userId);
    return this.getTiers(userId);
  }

  async clearCustomSnapshot(userId: string): Promise<void> {
    await this.tierRepo.update(
      { user_id: userId },
      { custom_model: null, updated_at: new Date().toISOString() },
    );
  }

  /* ── Preset recommendations ── */

  async getPresetRecommendations(
    userId: string,
  ): Promise<Record<string, Record<string, string | null>>> {
    const providers = await this.providerRepo.find({
      where: { user_id: userId, is_active: true },
    });
    const activeProviders = expandProviderNames(
      providers.map((p) => p.provider),
    );

    const allModels = this.pricingCache.getAll();
    const available = allModels.filter((m) =>
      activeProviders.has(m.provider.toLowerCase()),
    );

    const presets = ['eco', 'balanced', 'quality', 'fast'] as const;
    const result: Record<string, Record<string, string | null>> = {};

    for (const preset of presets) {
      result[preset] = {};
      for (const tier of TIERS) {
        const best = this.autoAssign.pickBestForPreset(
          available,
          tier as 'simple' | 'standard' | 'complex' | 'reasoning',
          preset,
        );
        result[preset][tier] = best?.model_name ?? null;
      }
    }

    return result;
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
