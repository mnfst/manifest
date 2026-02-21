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

  pickBest(models: ModelPricing[], tier: Tier): ScoredModel | null {
    if (models.length === 0) return null;

    const scored = models.map((m) => ({
      model_name: m.model_name,
      score: this.score(m, tier),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  /**
   * Scoring strategy per tier:
   *
   * - simple:    cheapest model wins (pure cost efficiency)
   * - standard:  cheapest model with code capability preferred
   * - complex:   quality-first — large context + code capability,
   *              cost as tiebreaker among equals
   * - reasoning: reasoning capability required, then quality, then cost
   *
   * Quality tiers (0-3) are used for complex/reasoning so that a more
   * capable but expensive model always beats a cheaper but less capable one.
   */
  private score(m: ModelPricing, tier: Tier): number {
    const totalPrice =
      Number(m.input_price_per_token) + Number(m.output_price_per_token);
    if (totalPrice <= 0) return 0;

    // Normalize cost to 0-1 range (higher = cheaper = better for cost)
    // Using log scale so ratios matter more than absolutes
    const costScore = 1 / Math.log2(totalPrice * 1e9 + 2);

    switch (tier) {
      case 'simple':
        // Pure cheapest wins
        return 1 / totalPrice;

      case 'standard': {
        // Cheapest wins, slight bonus for code capability
        const codeBonus = m.capability_code ? 1.2 : 1;
        return (1 / totalPrice) * codeBonus;
      }

      case 'complex': {
        // Quality tier: capabilities are primary, cost is tiebreaker
        let quality = 0;
        if (m.capability_code) quality += 1;
        if (m.capability_reasoning) quality += 1;
        if (m.context_window >= 100_000) quality += 1;
        // Quality is the major factor (x1000), cost is minor tiebreaker
        return quality * 1000 + costScore;
      }

      case 'reasoning': {
        // Reasoning required, then quality, then cost
        let quality = 0;
        if (m.capability_reasoning) quality += 3;
        if (m.capability_code) quality += 1;
        if (m.context_window >= 100_000) quality += 1;
        return quality * 1000 + costScore;
      }
    }
  }
}
