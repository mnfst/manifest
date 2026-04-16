import { Injectable, Logger } from '@nestjs/common';
import { TierService } from '../routing-core/tier.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { SpecificityService } from '../routing-core/specificity.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { scoreRequest, ScorerInput, MomentumInput, scanMessages } from '../../scoring';
import { Tier } from '../../scoring/types';
import { ResolveResponse } from '../dto/resolve-response';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';

@Injectable()
export class ResolveService {
  private readonly logger = new Logger(ResolveService.name);

  constructor(
    private readonly tierService: TierService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly specificityService: SpecificityService,
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
    specificityOverride?: string,
  ): Promise<ResolveResponse> {
    const specificityResult = await this.resolveSpecificity(
      agentId,
      messages,
      tools,
      specificityOverride,
    );
    if (specificityResult) return specificityResult;

    const input: ScorerInput = { messages, tools, tool_choice: toolChoice, max_tokens: maxTokens };
    const momentum: MomentumInput | undefined =
      recentTiers && recentTiers.length > 0 ? { recentTiers } : undefined;

    const result = scoreRequest(input, undefined, momentum);

    const tiers = await this.tierService.getTiers(agentId);
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

    const model = await this.providerKeyService.getEffectiveModel(agentId, assignment);

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

    const provider = await this.resolveProvider(agentId, assignment, model);
    const authType = provider
      ? (assignment.override_auth_type ??
        (await this.providerKeyService.getAuthType(agentId, provider)))
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
    const tiers = await this.tierService.getTiers(agentId);
    const assignment = tiers.find((t) => t.tier === tier);

    if (!assignment) {
      return { tier, model: null, provider: null, confidence: 1, score: 0, reason: 'heartbeat' };
    }

    const model = await this.providerKeyService.getEffectiveModel(agentId, assignment);
    const provider = model ? await this.resolveProvider(agentId, assignment, model) : null;
    const authType = provider
      ? (assignment.override_auth_type ??
        (await this.providerKeyService.getAuthType(agentId, provider)))
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

  private async resolveSpecificity(
    agentId: string,
    messages: ScorerInput['messages'],
    tools?: ScorerInput['tools'],
    headerOverride?: string,
  ): Promise<ResolveResponse | null> {
    const active = await this.specificityService.getActiveAssignments(agentId);
    if (active.length === 0) return null;

    const detected = scanMessages(messages, tools, headerOverride);
    if (!detected) return null;

    const assignment = active.find((a) => a.category === detected.category);
    if (!assignment) return null;

    const model = assignment.override_model ?? assignment.auto_assigned_model;
    if (!model) return null;

    const provider = await this.resolveProvider(
      agentId,
      {
        override_model: assignment.override_model,
        override_provider: assignment.override_provider,
      },
      model,
    );
    const authType = provider
      ? (assignment.override_auth_type ??
        (await this.providerKeyService.getAuthType(agentId, provider)))
      : undefined;

    return {
      tier: 'standard',
      model,
      provider,
      confidence: detected.confidence,
      score: 0,
      reason: 'specificity',
      auth_type: authType,
      specificity_category: detected.category,
      fallback_models: assignment.fallback_models ?? null,
    };
  }

  /**
   * Resolve provider for a model using multiple strategies:
   * 1. Infer from model name prefix (e.g. "anthropic/claude-opus-4-6" → "anthropic")
   * 2. Look up in discovered models (cached per-provider)
   * 3. Fall back to pricing cache
   */
  private async resolveProvider(
    agentId: string,
    assignment: { override_model: string | null; override_provider?: string | null },
    model: string,
  ): Promise<string | null> {
    if (assignment.override_model === model && assignment.override_provider) {
      return assignment.override_provider;
    }

    // 1. Infer from slash prefix — but only if that provider is actually connected.
    //    Models from proxy providers (e.g. OpenRouter) carry vendor prefixes
    //    like "anthropic/claude-sonnet-4" which would incorrectly resolve to
    //    the native provider when that provider is disabled (#1383).
    const prefix = inferProviderFromModelName(model);
    if (prefix && (await this.providerKeyService.hasActiveProvider(agentId, prefix))) {
      return prefix;
    }

    // 2. Check discovered models
    const discovered = await this.discoveryService.getModelForAgent(agentId, model);
    if (discovered) return discovered.provider;

    // 3. Fall back to pricing cache (mainly for cost lookups)
    const pricing = this.pricingCache.getByModel(model);
    if (pricing && pricing.provider !== 'OpenRouter') return pricing.provider;

    return null;
  }
}
