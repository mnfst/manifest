import { Injectable, Logger } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from './model-discovery/model-discovery.service';
import { scoreRequest, ScorerInput, MomentumInput } from './scorer';
import { Tier } from './scorer/types';
import { ResolveResponse } from './dto/resolve-response';
import { inferProviderFromModelName } from './provider-aliases';

@Injectable()
export class ResolveService {
  private readonly logger = new Logger(ResolveService.name);

  constructor(
    private readonly routingService: RoutingService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async resolve(
    agentId: string,
    messages: ScorerInput['messages'],
    tools?: ScorerInput['tools'],
    toolChoice?: unknown,
    maxTokens?: number,
    recentTiers?: MomentumInput['recentTiers'],
  ): Promise<ResolveResponse> {
    const input: ScorerInput = { messages, tools, tool_choice: toolChoice, max_tokens: maxTokens };
    const momentum: MomentumInput | undefined =
      recentTiers && recentTiers.length > 0 ? { recentTiers } : undefined;

    const result = scoreRequest(input, undefined, momentum);

    const tiers = await this.routingService.getTiers(agentId);
    const assignment = tiers.find((t) => t.tier === result.tier);

    if (!assignment) {
      this.logger.warn(
        `No tier assignment found for agent=${agentId} tier=${result.tier} ` +
          `(available tiers: ${tiers.map((t) => t.tier).join(', ') || 'none'})`,
      );
      return {
        tier: result.tier,
        model: null,
        provider: null,
        confidence: result.confidence,
        score: result.score,
        reason: result.reason,
      };
    }

    const model = await this.routingService.getEffectiveModel(agentId, assignment);

    if (!model) {
      this.logger.warn(
        `getEffectiveModel returned null for agent=${agentId} tier=${result.tier} ` +
          `override=${assignment.override_model} auto=${assignment.auto_assigned_model}`,
      );
      return {
        tier: result.tier,
        model: null,
        provider: null,
        confidence: result.confidence,
        score: result.score,
        reason: result.reason,
      };
    }

    const provider = await this.resolveProvider(agentId, model);
    const authType = provider
      ? (assignment.override_auth_type ??
        (await this.routingService.getAuthType(agentId, provider)))
      : undefined;

    return {
      tier: result.tier,
      model,
      provider,
      confidence: result.confidence,
      score: result.score,
      reason: result.reason,
      auth_type: authType,
    };
  }

  async resolveForTier(agentId: string, tier: Tier): Promise<ResolveResponse> {
    const tiers = await this.routingService.getTiers(agentId);
    const assignment = tiers.find((t) => t.tier === tier);

    if (!assignment) {
      return { tier, model: null, provider: null, confidence: 1, score: 0, reason: 'heartbeat' };
    }

    const model = await this.routingService.getEffectiveModel(agentId, assignment);
    const provider = model ? await this.resolveProvider(agentId, model) : null;
    const authType = provider
      ? (assignment.override_auth_type ??
        (await this.routingService.getAuthType(agentId, provider)))
      : undefined;

    return {
      tier,
      model: model ?? null,
      provider,
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
      auth_type: authType,
    };
  }

  /**
   * Resolve provider for a model using multiple strategies:
   * 1. Infer from model name prefix (e.g. "anthropic/claude-opus-4-6" → "anthropic")
   * 2. Look up in discovered models (cached per-provider)
   * 3. Fall back to pricing cache
   */
  private async resolveProvider(agentId: string, model: string): Promise<string | null> {
    // 1. Infer from slash prefix
    const prefix = inferProviderFromModelName(model);
    if (prefix) return prefix;

    // 2. Check discovered models
    const discovered = await this.discoveryService.getModelForAgent(agentId, model);
    if (discovered) return discovered.provider;

    // 3. Fall back to pricing cache (mainly for cost lookups)
    const pricing = this.pricingCache.getByModel(model);
    if (pricing && pricing.provider !== 'OpenRouter') return pricing.provider;

    return null;
  }
}
