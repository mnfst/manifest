import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { TierService } from '../routing-core/tier.service';
import { SpecificityService } from '../routing-core/specificity.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';

/**
 * Floor returned when the agent has no routable models yet. Matches the
 * default used by `ProviderModelFetcherService` so clients see a consistent
 * value whether they call us during onboarding or after connecting providers.
 */
export const DEFAULT_ADVERTISED_CONTEXT = 128_000;

export interface EffectiveContext {
  contextLength: number;
  /** True when the value came from the per-agent override. */
  overridden: boolean;
}

/**
 * Computes the honest `context_length` advertised on `GET /v1/models` for
 * `manifest/auto`. The number is the **minimum** `context_window` across
 * every model the agent could actually be routed to (tier primaries,
 * fallbacks, and active specificity overrides). Any model Manifest picks is
 * guaranteed to accept at least this many tokens, so clients that compact to
 * the advertised floor never overflow the routed model.
 *
 * Why minimum instead of maximum or average: issues #1617 / #1612 / #1450 all
 * trace back to clients assuming a larger window than the routed model
 * actually offers. The floor is the only value that's safe to advertise
 * without knowing which model this particular request will land on.
 */
@Injectable()
export class ContextAdvertisementService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly tierService: TierService,
    private readonly specificityService: SpecificityService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async getEffectiveContext(agentId: string): Promise<EffectiveContext> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (agent?.context_floor_override) {
      return { contextLength: agent.context_floor_override, overridden: true };
    }

    const candidates = await this.collectCandidateModels(agentId);
    if (candidates.size === 0) {
      return { contextLength: DEFAULT_ADVERTISED_CONTEXT, overridden: false };
    }

    const contexts: number[] = [];
    for (const modelId of candidates) {
      const discovered = await this.discoveryService.getModelForAgent(agentId, modelId);
      if (discovered && discovered.contextWindow > 0) {
        contexts.push(discovered.contextWindow);
      }
    }

    if (contexts.length === 0) {
      return { contextLength: DEFAULT_ADVERTISED_CONTEXT, overridden: false };
    }

    return { contextLength: Math.min(...contexts), overridden: false };
  }

  private async collectCandidateModels(agentId: string): Promise<Set<string>> {
    const models = new Set<string>();

    const tiers = await this.tierService.getTiers(agentId);
    for (const tier of tiers) {
      const primary = tier.override_model ?? tier.auto_assigned_model;
      if (primary) models.add(primary);
      if (tier.fallback_models) {
        for (const fallback of tier.fallback_models) models.add(fallback);
      }
    }

    const active = await this.specificityService.getActiveAssignments(agentId);
    for (const assignment of active) {
      const primary = assignment.override_model ?? assignment.auto_assigned_model;
      if (primary) models.add(primary);
      if (assignment.fallback_models) {
        for (const fallback of assignment.fallback_models) models.add(fallback);
      }
    }

    return models;
  }
}
