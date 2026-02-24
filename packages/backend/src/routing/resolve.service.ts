import { Injectable } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { scoreRequest, ScorerInput, MomentumInput } from './scorer';
import { Tier } from './scorer/types';
import { ResolveResponse } from './dto/resolve-response';

@Injectable()
export class ResolveService {
  constructor(
    private readonly routingService: RoutingService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async resolve(
    userId: string,
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

    const tiers = await this.routingService.getTiers(userId);
    const assignment = tiers.find((t) => t.tier === result.tier);

    if (!assignment) {
      return {
        tier: result.tier,
        model: null,
        provider: null,
        confidence: result.confidence,
        score: result.score,
        reason: result.reason,
      };
    }

    const model = await this.routingService.getEffectiveModel(userId, assignment);

    if (!model) {
      return {
        tier: result.tier,
        model: null,
        provider: null,
        confidence: result.confidence,
        score: result.score,
        reason: result.reason,
      };
    }

    const pricing = this.pricingCache.getByModel(model);

    return {
      tier: result.tier,
      model,
      provider: pricing?.provider ?? null,
      confidence: result.confidence,
      score: result.score,
      reason: result.reason,
    };
  }

  async resolveForTier(userId: string, tier: Tier): Promise<ResolveResponse> {
    const tiers = await this.routingService.getTiers(userId);
    const assignment = tiers.find((t) => t.tier === tier);

    if (!assignment) {
      return { tier, model: null, provider: null, confidence: 1, score: 0, reason: 'heartbeat' };
    }

    const model = await this.routingService.getEffectiveModel(userId, assignment);
    const pricing = model ? this.pricingCache.getByModel(model) : null;

    return {
      tier,
      model: model ?? null,
      provider: pricing?.provider ?? null,
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
    };
  }
}
