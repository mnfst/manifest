import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DEFAULT_TIER_SLOT,
  headerTierNameToModelAlias,
  SPECIFICITY_CATEGORIES,
  specificityCategoryToAlias,
  TIERS,
  type TierSlot,
} from 'manifest-shared';
import { Agent } from '../entities/agent.entity';
import { TierService } from './routing-core/tier.service';
import { SpecificityService } from './routing-core/specificity.service';
import { HeaderTierService } from './header-tiers/header-tier.service';
import { effectiveRoute, readOverrideRoute } from './routing-core/route-helpers';

/**
 * Lists `model` aliases that are actually routable for an agent (assigned model
 * on the tier/category/custom card). Always includes `auto`.
 */
@Injectable()
export class RoutingAliasService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly tierService: TierService,
    private readonly specificityService: SpecificityService,
    private readonly headerTierService: HeaderTierService,
  ) {}

  async listConfiguredAliases(agentId: string): Promise<string[]> {
    const aliases: string[] = ['auto'];

    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    const complexitySlots: readonly TierSlot[] = agent?.complexity_routing_enabled
      ? TIERS
      : [DEFAULT_TIER_SLOT];

    const tierRows = await this.tierService.getTiers(agentId);
    const tierBySlot = new Map(tierRows.map((t) => [t.tier, t]));
    for (const slot of complexitySlots) {
      const row = tierBySlot.get(slot);
      if (row && effectiveRoute(row)) aliases.push(slot);
    }

    const active = await this.specificityService.getActiveAssignments(agentId);
    const activeByCategory = new Map(active.map((a) => [a.category, a]));
    for (const category of SPECIFICITY_CATEGORIES) {
      const row = activeByCategory.get(category);
      if (row && effectiveRoute(row)) aliases.push(specificityCategoryToAlias(category));
    }

    const headerTiers = await this.headerTierService.list(agentId);
    for (const tier of headerTiers) {
      if (!tier.enabled) continue;
      const alias = headerTierNameToModelAlias(tier.name);
      if (!alias || !readOverrideRoute(tier)) continue;
      aliases.push(alias);
    }

    return aliases;
  }
}
