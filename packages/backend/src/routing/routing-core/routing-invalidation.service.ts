import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';

@Injectable()
export class RoutingInvalidationService {
  private readonly logger = new Logger(RoutingInvalidationService.name);

  constructor(
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly autoAssign: TierAutoAssignService,
    private readonly routingCache: RoutingCacheService,
  ) {}

  /**
   * Clears overrides and fallback entries for models that have been removed
   * from the pricing database (e.g. after a pricing sync).
   */
  async invalidateOverridesForRemovedModels(removedModels: string[]): Promise<void> {
    if (removedModels.length === 0) return;
    void this.pricingCache; // suppress unused warning, kept for future cost-aware invalidation

    const removedSet = new Set(removedModels);

    // Single-pass full scan: examine override_route + fallback_routes on every
    // tier and clear references to removed model names. Per-tenant table size
    // makes a full scan cheap and removes the scope-narrowing bug from the
    // earlier dual-write design.
    const allTiers = await this.tierRepo.find();
    const agentIds = new Set<string>();
    const tiersToSave: TierAssignment[] = [];
    let invalidatedCount = 0;

    for (const tier of allTiers) {
      let mutated = false;
      if (tier.override_route && removedSet.has(tier.override_route.model)) {
        this.logger.warn(
          `Clearing override ${tier.override_route.model} for agent ${tier.agent_id} tier ${tier.tier} (model removed)`,
        );
        tier.override_route = null;
        mutated = true;
        invalidatedCount += 1;
      }
      if (tier.fallback_routes && tier.fallback_routes.length > 0) {
        const filtered = tier.fallback_routes.filter((r) => !removedSet.has(r.model));
        if (filtered.length !== tier.fallback_routes.length) {
          tier.fallback_routes = filtered.length > 0 ? filtered : null;
          mutated = true;
        }
      }
      if (mutated) {
        tier.updated_at = new Date().toISOString();
        tiersToSave.push(tier);
        agentIds.add(tier.agent_id);
      }
    }

    if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

    if (agentIds.size === 0) return;

    await Promise.all(
      [...agentIds].map((agentId) => {
        this.routingCache.invalidateAgent(agentId);
        return this.autoAssign.recalculate(agentId);
      }),
    );

    this.logger.log(
      `Invalidated ${invalidatedCount} overrides for ${agentIds.size} agents (removed models: ${removedModels.join(', ')})`,
    );
  }
}
