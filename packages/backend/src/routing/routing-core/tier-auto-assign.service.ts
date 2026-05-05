import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { DiscoveredModel } from '../../model-discovery/model-fetcher';
import { randomUUID } from 'crypto';
import { Tier } from '../../scoring/types';
import type { ModelRoute } from 'manifest-shared';
import { TIER_SLOTS } from 'manifest-shared';

/**
 * OpenAI subscription tokens only work with Codex models (zero cost).
 * Paid API models like gpt-4o need API keys. Per-provider: if zero-cost
 * models exist from a provider, only those are subscription-compatible.
 * Providers without zero-cost models (e.g. Anthropic) keep all models.
 */
function filterSubModels(models: DiscoveredModel[]): DiscoveredModel[] {
  const byProvider = new Map<string, DiscoveredModel[]>();
  for (const m of models) {
    const key = m.provider.toLowerCase();
    const arr = byProvider.get(key) ?? [];
    arr.push(m);
    byProvider.set(key, arr);
  }

  const result: DiscoveredModel[] = [];
  for (const providerModels of byProvider.values()) {
    const zeroCost = providerModels.filter(
      (m) =>
        m.inputPricePerToken != null &&
        m.outputPricePerToken != null &&
        m.inputPricePerToken === 0 &&
        m.outputPricePerToken === 0,
    );
    // If zero-cost models exist (e.g. OpenAI Codex), use only those
    result.push(...(zeroCost.length > 0 ? zeroCost : providerModels));
  }
  return result;
}

interface ScoredModel {
  model_name: string;
  score: number;
  route: ModelRoute | null;
}

function buildRoute(picked: DiscoveredModel): ModelRoute | null {
  if (!picked.authType) return null;
  return { provider: picked.provider, authType: picked.authType, model: picked.id };
}

@Injectable()
export class TierAutoAssignService {
  private readonly logger = new Logger(TierAutoAssignService.name);

  constructor(
    private readonly discoveryService: ModelDiscoveryService,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
  ) {}

  async recalculate(agentId: string): Promise<void> {
    const allModels = await this.discoveryService.getModelsForAgent(agentId);

    // Separate subscription vs API key models using the authType field on each model.
    // filterSubModels further narrows subscription models: if a provider has zero-cost
    // models (e.g. OpenAI Codex), only those are used for subscription routing.
    const subModels = filterSubModels(allModels.filter((m) => m.authType === 'subscription'));
    const keyModels = allModels.filter((m) => m.authType !== 'subscription');

    // Batch read all tiers in one query
    const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    const tierMap = new Map(allTiers.map((t) => [t.tier, t]));

    const toSave: TierAssignment[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (const slot of TIER_SLOTS) {
      // The 'default' slot picks a balanced model — same heuristic as 'standard'.
      const pickTier: Tier = slot === 'default' ? 'standard' : (slot as Tier);
      // Subscription models always take priority over API key models
      const best = this.pickBest(subModels, pickTier) ?? this.pickBest(keyModels, pickTier);
      const existing = tierMap.get(slot);

      if (existing) {
        existing.auto_assigned_route = best?.route ?? null;
        existing.updated_at = new Date().toISOString();
        toSave.push(existing);
      } else {
        toInsert.push({
          id: randomUUID(),
          user_id: '',
          agent_id: agentId,
          tier: slot,
          override_route: null,
          auto_assigned_route: best?.route ?? null,
          fallback_routes: null,
        });
      }
    }

    // Batch write
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
  pickBest(models: DiscoveredModel[], tier: Tier): ScoredModel | null {
    if (models.length === 0) return null;

    const totalPrice = (m: DiscoveredModel) => {
      if (m.inputPricePerToken == null || m.outputPricePerToken == null) return Infinity;
      return Number(m.inputPricePerToken) + Number(m.outputPricePerToken);
    };

    const quality = (m: DiscoveredModel) => m.qualityScore ?? 3;

    // Sort by price ascending (cheapest first, including free local models)
    const byPrice = [...models].sort((a, b) => totalPrice(a) - totalPrice(b));

    let picked: DiscoveredModel = byPrice[0];

    switch (tier) {
      case 'simple': {
        picked = byPrice[0];
        break;
      }

      case 'standard': {
        const eligible = byPrice.filter((m) => quality(m) >= 2);
        const pool = eligible.length > 0 ? eligible : byPrice;
        const toolCapable = pool.filter((m) => m.capabilityCode);
        picked = toolCapable.length > 0 ? toolCapable[0] : pool[0];
        break;
      }

      case 'complex': {
        const byQuality = [...byPrice].sort((a, b) => quality(b) - quality(a));
        const toolCapable = byQuality.filter((m) => m.capabilityCode);
        picked = toolCapable.length > 0 ? toolCapable[0] : byQuality[0];
        break;
      }

      case 'reasoning': {
        const reasoningModels = byPrice.filter((m) => m.capabilityReasoning);
        if (reasoningModels.length > 0) {
          const byQuality = [...reasoningModels].sort((a, b) => quality(b) - quality(a));
          const toolCapable = byQuality.filter((m) => m.capabilityCode);
          picked = toolCapable.length > 0 ? toolCapable[0] : byQuality[0];
        } else {
          const byQuality = [...byPrice].sort((a, b) => quality(b) - quality(a));
          const toolCapable = byQuality.filter((m) => m.capabilityCode);
          picked = toolCapable.length > 0 ? toolCapable[0] : byQuality[0];
        }
        break;
      }
    }

    return { model_name: picked.id, score: quality(picked), route: buildRoute(picked) };
  }
}
