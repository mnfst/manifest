import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { randomUUID } from 'crypto';
import { expandProviderNames } from './provider-aliases';

const TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;
type Tier = (typeof TIERS)[number];

const PRESETS = ['eco', 'balanced', 'quality', 'fast'] as const;
export type Preset = (typeof PRESETS)[number];

interface ScoredModel {
  model_name: string;
  score: number;
}

@Injectable()
export class TierAutoAssignService {
  private readonly logger = new Logger(TierAutoAssignService.name);

  constructor(
    private readonly pricingCache: ModelPricingCacheService,
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
  ) {}

  async recalculate(userId: string): Promise<void> {
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

    for (const tier of TIERS) {
      const best = this.pickBest(available, tier);
      const existing = await this.tierRepo.findOne({
        where: { user_id: userId, tier },
      });

      if (existing) {
        existing.auto_assigned_model = best?.model_name ?? null;
        existing.updated_at = new Date().toISOString();
        await this.tierRepo.save(existing);
      } else {
        await this.tierRepo.insert({
          id: randomUUID(),
          user_id: userId,
          tier,
          override_model: null,
          auto_assigned_model: best?.model_name ?? null,
        });
      }
    }

    this.logger.log(`Recalculated tier assignments for user ${userId}`);
  }

  /**
   * Deterministic sorting per tier — no magic formulas.
   *
   * SIMPLE    — cheapest wins (pure cost).
   * STANDARD  — cheapest among quality >= 2 (excludes ultra-low-cost).
   * COMPLEX   — highest quality wins; cost breaks ties.
   * REASONING — highest quality among reasoning-capable models;
   *             falls back to COMPLEX if none have reasoning.
   */
  pickBest(models: ModelPricing[], tier: Tier): ScoredModel | null {
    if (models.length === 0) return null;

    const totalPrice = (m: ModelPricing) =>
      Number(m.input_price_per_token) + Number(m.output_price_per_token);

    const quality = (m: ModelPricing) => m.quality_score ?? 3;

    // Sort by price ascending (cheapest first)
    const byPrice = [...models]
      .filter((m) => totalPrice(m) > 0)
      .sort((a, b) => totalPrice(a) - totalPrice(b));

    if (byPrice.length === 0) return null;

    let picked: ModelPricing;

    switch (tier) {
      case 'simple': {
        // Cheapest model wins
        picked = byPrice[0];
        break;
      }

      case 'standard': {
        // Cheapest among quality >= 2; fallback to cheapest overall
        const eligible = byPrice.filter((m) => quality(m) >= 2);
        picked = eligible.length > 0 ? eligible[0] : byPrice[0];
        break;
      }

      case 'complex': {
        // Best quality first, then cheapest as tiebreaker
        const byQuality = [...byPrice].sort(
          (a, b) => quality(b) - quality(a),
        );
        picked = byQuality[0];
        break;
      }

      case 'reasoning': {
        // Among reasoning-capable: best quality, then cheapest
        const reasoningModels = byPrice.filter(
          (m) => m.capability_reasoning,
        );
        if (reasoningModels.length > 0) {
          const byQuality = [...reasoningModels].sort(
            (a, b) => quality(b) - quality(a),
          );
          picked = byQuality[0];
        } else {
          // Fallback to COMPLEX logic
          const byQuality = [...byPrice].sort(
            (a, b) => quality(b) - quality(a),
          );
          picked = byQuality[0];
        }
        break;
      }
    }

    return { model_name: picked.model_name, score: quality(picked) };
  }

  /**
   * Preset-aware model selection.
   *
   * ECO       — cheapest model for every tier.
   * BALANCED  — delegates to the existing per-tier `pickBest` logic.
   * QUALITY   — highest quality_score; cheapest as tiebreaker.
   * FAST      — smallest context_window (speed proxy); cheapest as tiebreaker.
   *
   * For the REASONING tier in all presets: reasoning-capable models are
   * preferred when available.
   */
  pickBestForPreset(
    models: ModelPricing[],
    tier: Tier,
    preset: Preset,
  ): ScoredModel | null {
    if (models.length === 0) return null;

    if (preset === 'balanced') return this.pickBest(models, tier);

    const totalPrice = (m: ModelPricing) =>
      Number(m.input_price_per_token) + Number(m.output_price_per_token);

    const quality = (m: ModelPricing) => m.quality_score ?? 3;

    // Filter out zero-price models
    let pool = models.filter((m) => totalPrice(m) > 0);
    if (pool.length === 0) return null;

    // For reasoning tier: prefer reasoning-capable models if any exist
    if (tier === 'reasoning') {
      const reasoningPool = pool.filter((m) => m.capability_reasoning);
      if (reasoningPool.length > 0) pool = reasoningPool;
    }

    // Sort by price ascending as the base order
    pool.sort((a, b) => totalPrice(a) - totalPrice(b));

    let picked: ModelPricing;

    switch (preset) {
      case 'eco': {
        // Cheapest model regardless of tier
        picked = pool[0];
        break;
      }

      case 'quality': {
        // Highest quality_score first, cheapest as tiebreaker
        const byQuality = [...pool].sort(
          (a, b) => quality(b) - quality(a),
        );
        picked = byQuality[0];
        break;
      }

      case 'fast': {
        // Smallest context_window first, cheapest as tiebreaker
        const byContext = [...pool].sort(
          (a, b) => (a.context_window ?? 0) - (b.context_window ?? 0),
        );
        picked = byContext[0];
        break;
      }
    }

    return { model_name: picked.model_name, score: quality(picked) };
  }
}
