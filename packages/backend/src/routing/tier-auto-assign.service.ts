import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { randomUUID } from 'crypto';
import { expandProviderNames, inferProviderFromModelName } from './provider-aliases';
import { TIERS, Tier } from './scorer/types';

/**
 * OpenAI subscription tokens only work with Codex models (zero cost).
 * Paid API models like gpt-4o need API keys. Per-provider: if zero-cost
 * models exist from a provider, only those are subscription-compatible.
 * Providers without zero-cost models (e.g. Anthropic) keep all models.
 */
function filterSubModels(models: ModelPricing[]): ModelPricing[] {
  const byProvider = new Map<string, ModelPricing[]>();
  for (const m of models) {
    const key = m.provider.toLowerCase();
    const arr = byProvider.get(key) ?? [];
    arr.push(m);
    byProvider.set(key, arr);
  }

  const result: ModelPricing[] = [];
  for (const providerModels of byProvider.values()) {
    const zeroCost = providerModels.filter(
      (m) =>
        (m.input_price_per_token == null || Number(m.input_price_per_token) === 0) &&
        (m.output_price_per_token == null || Number(m.output_price_per_token) === 0),
    );
    // If zero-cost models exist (e.g. OpenAI Codex), use only those
    result.push(...(zeroCost.length > 0 ? zeroCost : providerModels));
  }
  return result;
}

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

  async recalculate(agentId: string, providers?: UserProvider[]): Promise<void> {
    // 2B: Accept optional providers to avoid duplicate query
    const resolvedProviders =
      providers ??
      (await this.providerRepo.find({
        where: { agent_id: agentId, is_active: true },
      }));

    const subNames = expandProviderNames(
      resolvedProviders.filter((p) => p.auth_type === 'subscription').map((p) => p.provider),
    );
    const keyNames = expandProviderNames(
      resolvedProviders.filter((p) => p.auth_type !== 'subscription').map((p) => p.provider),
    );

    const allModels = this.pricingCache.getAll();
    const matchesProvider = (model: ModelPricing, names: Set<string>): boolean => {
      if (names.has(model.provider.toLowerCase())) return true;
      // Only infer provider from model name prefix for non-OpenRouter models.
      // OpenRouter-hosted models (e.g. "anthropic/claude-sonnet-4-5" with
      // provider "OpenRouter") should not match direct providers.
      if (model.provider === 'OpenRouter') return false;
      const prefix = inferProviderFromModelName(model.model_name);
      return prefix != null && names.has(prefix);
    };
    const subModels = filterSubModels(allModels.filter((m) => matchesProvider(m, subNames)));
    const keyModels = allModels.filter((m) => matchesProvider(m, keyNames));

    // 2C: Batch read all tiers in one query
    const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    const tierMap = new Map(allTiers.map((t) => [t.tier, t]));

    const toSave: TierAssignment[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (const tier of TIERS) {
      // Subscription models always take priority over API key models
      const best = this.pickBest(subModels, tier) ?? this.pickBest(keyModels, tier);
      const existing = tierMap.get(tier);

      if (existing) {
        existing.auto_assigned_model = best?.model_name ?? null;
        existing.updated_at = new Date().toISOString();
        toSave.push(existing);
      } else {
        toInsert.push({
          id: randomUUID(),
          user_id: '',
          agent_id: agentId,
          tier,
          override_model: null,
          auto_assigned_model: best?.model_name ?? null,
        });
      }
    }

    // 2C: Batch write
    if (toSave.length > 0) await this.tierRepo.save(toSave);
    if (toInsert.length > 0) await this.tierRepo.insert(toInsert);

    this.logger.log(`Recalculated tier assignments for agent ${agentId}`);
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
      (m.input_price_per_token != null ? Number(m.input_price_per_token) : 0) +
      (m.output_price_per_token != null ? Number(m.output_price_per_token) : 0);

    const quality = (m: ModelPricing) => m.quality_score ?? 3;

    // Sort by price ascending (cheapest first, including free local models)
    const byPrice = [...models].sort((a, b) => totalPrice(a) - totalPrice(b));

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
        const byQuality = [...byPrice].sort((a, b) => quality(b) - quality(a));
        picked = byQuality[0];
        break;
      }

      case 'reasoning': {
        // Among reasoning-capable: best quality, then cheapest
        const reasoningModels = byPrice.filter((m) => m.capability_reasoning);
        if (reasoningModels.length > 0) {
          const byQuality = [...reasoningModels].sort((a, b) => quality(b) - quality(a));
          picked = byQuality[0];
        } else {
          // Fallback to COMPLEX logic
          const byQuality = [...byPrice].sort((a, b) => quality(b) - quality(a));
          picked = byQuality[0];
        }
        break;
      }
    }

    return { model_name: picked.model_name, score: quality(picked) };
  }
}
