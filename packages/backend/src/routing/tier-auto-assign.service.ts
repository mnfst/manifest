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

  private score(m: ModelPricing, tier: Tier): number {
    const totalPrice =
      Number(m.input_price_per_token) + Number(m.output_price_per_token);
    if (totalPrice <= 0) return 0;

    const baseCost = 1 / totalPrice;

    switch (tier) {
      case 'simple':
      case 'standard':
        return baseCost;
      case 'complex': {
        const contextBonus = m.context_window >= 100_000 ? 1.5 : 1;
        return baseCost * contextBonus;
      }
      case 'reasoning': {
        const reasoningBonus = m.capability_reasoning ? 3 : 1;
        return baseCost * reasoningBonus;
      }
    }
  }
}
