import { Injectable, Logger } from '@nestjs/common';
import { TierService } from '../routing-core/tier.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { SpecificityService } from '../routing-core/specificity.service';
import { SpecificityPenaltyService } from '../routing-core/specificity-penalty.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { scoreRequest, ScorerInput, MomentumInput, scanMessages } from '../../scoring';
import { Tier, TIERS } from '../../scoring/types';
import {
  ResolveResponse,
  ResolveReason,
  AuthType,
  REASON_SIZE_ESCALATED,
  REASON_CONTEXT_WINDOW_EXCEEDED,
} from '../dto/resolve-response';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { findFittingCandidate, FitCandidate, DEFAULT_RESERVED_OUTPUT_TOKENS } from './context-fit';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import type { SpecificityCategory } from 'manifest-shared';

/** Outcome of the score step that gets handed to the resolution helpers. */
interface ScoredResult {
  tier: Tier;
  confidence: number;
  score: number;
  reason: ResolveReason;
}

/** A concrete tier + model pick from the size-aware walk. */
interface TierPick {
  tier: Tier;
  assignment: TierAssignment;
  fit: FitCandidate;
}

/**
 * When specificity detection is below this confidence, skip specificity
 * routing and fall through to the complexity tier. Low-confidence detections
 * are the ones that misrouted coding sessions to web_browsing (discussion
 * #1613) — the safer call is to route by complexity instead of committing to
 * an ambiguous specificity category. Kept below the typical
 * single-strong-anchor confidence (0.33 for web_browsing at threshold 3) but
 * above the score-equals-threshold minimum, so clean 2-signal detections
 * (keyword + URL, keyword + tool) still pass.
 */
const MIN_SPECIFICITY_CONFIDENCE = 0.4;

@Injectable()
export class ResolveService {
  private readonly logger = new Logger(ResolveService.name);

  constructor(
    private readonly tierService: TierService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly specificityService: SpecificityService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly penaltyService: SpecificityPenaltyService,
  ) {}

  /**
   * @param estimatedTokens  When `>0`, the resolver runs the Phase 2
   *   size-aware walk (filter tier candidates by context window, escalate
   *   if nothing fits). When 0 or undefined, the legacy scored-tier pick
   *   is used — used by heartbeat traffic and any caller that doesn't
   *   need size-awareness (e.g. the /resolve REST endpoint).
   */
  async resolve(
    agentId: string,
    messages: ScorerInput['messages'],
    tools?: ScorerInput['tools'],
    toolChoice?: unknown,
    maxTokens?: number,
    recentTiers?: MomentumInput['recentTiers'],
    specificityOverride?: string,
    recentCategories?: readonly SpecificityCategory[],
    estimatedTokens?: number,
  ): Promise<ResolveResponse> {
    const specificityResult = await this.resolveSpecificity(
      agentId,
      messages,
      tools,
      specificityOverride,
      recentCategories,
    );
    if (specificityResult) return specificityResult;

    const input: ScorerInput = { messages, tools, tool_choice: toolChoice, max_tokens: maxTokens };
    const momentum: MomentumInput | undefined =
      recentTiers && recentTiers.length > 0 ? { recentTiers } : undefined;

    const scored: ScoredResult = scoreRequest(input, undefined, momentum);
    const tiers = await this.tierService.getTiers(agentId);

    if (estimatedTokens !== undefined && estimatedTokens > 0) {
      return this.resolveWithSizeCheck(agentId, tiers, scored, estimatedTokens, maxTokens);
    }

    return this.resolveForScoredTier(agentId, tiers, scored);
  }

  private async resolveForScoredTier(
    agentId: string,
    tiers: TierAssignment[],
    scored: ScoredResult,
  ): Promise<ResolveResponse> {
    const assignment = tiers.find((t) => t.tier === scored.tier);
    if (!assignment) {
      this.logger.warn(
        `No tier assignment found for agent=${agentId} tier=${scored.tier} ` +
          `(available tiers: ${tiers.map((t) => t.tier).join(', ') || 'none'})`,
      );
      return this.emptyResponse(scored);
    }

    const model = await this.providerKeyService.getEffectiveModel(agentId, assignment);
    if (!model) {
      this.logger.warn(
        `getEffectiveModel returned null for agent=${agentId} tier=${scored.tier} ` +
          `override=${assignment.override_model} auto=${assignment.auto_assigned_model}`,
      );
      return this.emptyResponse(scored);
    }

    const { provider, authType } = await this.resolveProviderAndAuth(agentId, assignment, model);

    return {
      tier: scored.tier,
      model,
      provider,
      confidence: scored.confidence,
      score: scored.score,
      reason: scored.reason,
      auth_type: authType,
    };
  }

  /**
   * Size-aware variant — walks scored tier → higher tiers, picks the first
   * model that fits, falls back to a `context_window_exceeded` response if
   * nothing in any tier fits. Never silently routes to a too-small model
   * (see #1617). Delegates the "which tier?" logic to `pickFittingTier` so
   * this method just orchestrates the happy/sad branches.
   */
  private async resolveWithSizeCheck(
    agentId: string,
    tiers: TierAssignment[],
    scored: ScoredResult,
    estimatedTokens: number,
    maxTokens: number | undefined,
  ): Promise<ResolveResponse> {
    const reservedOutput = maxTokens && maxTokens > 0 ? maxTokens : DEFAULT_RESERVED_OUTPUT_TOKENS;
    const discovered = await this.discoveryService.getModelsForAgent(agentId);
    const contextByModel = new Map(discovered.map((m) => [m.id, m.contextWindow]));
    const walk = this.pickFittingTier(
      tiers,
      scored.tier,
      contextByModel,
      estimatedTokens,
      reservedOutput,
    );

    if (!walk.pick) {
      this.logger.warn(
        `context_window_exceeded agent=${agentId} estimated=${estimatedTokens} ` +
          `reserved=${reservedOutput} largest=${walk.largestSeen}`,
      );
      return {
        tier: scored.tier,
        model: null,
        provider: null,
        confidence: scored.confidence,
        score: scored.score,
        reason: REASON_CONTEXT_WINDOW_EXCEEDED,
        estimated_tokens: estimatedTokens,
        reserved_output_tokens: reservedOutput,
        largest_available_context: walk.largestSeen,
      };
    }

    const { tier, assignment, fit } = walk.pick;
    const { provider, authType } = await this.resolveProviderAndAuth(
      agentId,
      assignment,
      fit.model,
    );
    const escalated = tier !== scored.tier;

    return {
      tier,
      model: fit.model,
      provider,
      confidence: scored.confidence,
      score: scored.score,
      reason: escalated ? REASON_SIZE_ESCALATED : scored.reason,
      auth_type: authType,
      estimated_tokens: estimatedTokens,
      used_context_window: fit.contextWindow,
      size_escalated_from: escalated ? scored.tier : undefined,
    };
  }

  /**
   * Walks the tiers from the scored tier upward and returns the first
   * tier whose candidates contain a model that fits. Also returns the
   * largest context window seen across all walked tiers so the caller
   * can build a useful `context_window_exceeded` error when nothing fits.
   */
  private pickFittingTier(
    tiers: TierAssignment[],
    scoredTier: Tier,
    contextByModel: Map<string, number>,
    estimatedTokens: number,
    reservedOutput: number,
  ): { pick: TierPick | null; largestSeen: number } {
    // Cheapest fitting tier wins — walk upward from the scored tier.
    const scoredIndex = TIERS.indexOf(scoredTier);
    let largestSeen = 0;
    let pick: TierPick | null = null;

    for (let i = scoredIndex; i < TIERS.length; i++) {
      const tier = TIERS[i]!;
      const assignment = tiers.find((t) => t.tier === tier);
      if (!assignment) continue;

      const candidates = this.buildFitCandidates(assignment, contextByModel);
      for (const { contextWindow } of candidates) {
        if (contextWindow > largestSeen) largestSeen = contextWindow;
      }

      if (pick) continue;
      const fit = findFittingCandidate(candidates, estimatedTokens, reservedOutput);
      if (fit) pick = { tier, assignment, fit };
    }

    return { pick, largestSeen };
  }

  private buildFitCandidates(
    assignment: TierAssignment,
    contextByModel: Map<string, number>,
  ): FitCandidate[] {
    const ordered: string[] = [];
    const primary = assignment.override_model ?? assignment.auto_assigned_model;
    if (primary) ordered.push(primary);
    if (assignment.fallback_models) ordered.push(...assignment.fallback_models);

    const seen = new Set<string>();
    const candidates: FitCandidate[] = [];
    for (const model of ordered) {
      if (seen.has(model)) continue;
      seen.add(model);
      const contextWindow = contextByModel.get(model);
      if (contextWindow === undefined) continue;
      if (contextWindow <= 0) {
        // Misconfigured provider — log once so ops can track down the bad
        // `cached_models` row instead of silently black-holing the model.
        this.logger.debug(`Skipping model ${model}: non-positive contextWindow ${contextWindow}`);
        continue;
      }
      candidates.push({ model, contextWindow });
    }
    return candidates;
  }

  /**
   * Shared helper for the two success paths in this service: look up the
   * provider for a chosen model, then resolve the auth type (honouring a
   * per-tier override). Identical logic across both paths by design — the
   * only variance is which model gets passed in.
   */
  private async resolveProviderAndAuth(
    agentId: string,
    assignment: Pick<TierAssignment, 'override_model' | 'override_provider' | 'override_auth_type'>,
    model: string,
  ): Promise<{ provider: string | null; authType: AuthType | undefined }> {
    const provider = await this.resolveProvider(agentId, assignment, model);
    const authType = provider
      ? ((assignment.override_auth_type as AuthType | null) ??
        (await this.providerKeyService.getAuthType(agentId, provider)))
      : undefined;
    return { provider, authType };
  }

  private emptyResponse(scored: ScoredResult): ResolveResponse {
    return {
      tier: scored.tier,
      model: null,
      provider: null,
      confidence: scored.confidence,
      score: scored.score,
      reason: scored.reason,
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
    recentCategories?: readonly SpecificityCategory[],
  ): Promise<ResolveResponse | null> {
    const active = await this.specificityService.getActiveAssignments(agentId);
    if (active.length === 0) return null;

    const penalties = await this.penaltyService.getPenaltiesForAgent(agentId);
    const detected = scanMessages(
      messages,
      tools,
      headerOverride,
      recentCategories,
      penalties.size > 0 ? penalties : undefined,
    );
    if (!detected) return null;

    // Confidence gate: a weak detection (single keyword match, no corroborating
    // signal) is the one that misroutes coding sessions. Fall through to
    // complexity routing instead of committing to the ambiguous category.
    // Header overrides bypass the gate because they are explicit user intent.
    if (!headerOverride && detected.confidence < MIN_SPECIFICITY_CONFIDENCE) {
      this.logger.debug(
        `Specificity detected=${detected.category} ` +
          `confidence=${detected.confidence.toFixed(2)} below ${MIN_SPECIFICITY_CONFIDENCE} — ` +
          `falling through to complexity routing`,
      );
      return null;
    }

    const assignment = active.find((a) => a.category === detected.category);
    if (!assignment) return null;

    const model = await this.resolveSpecificityModel(agentId, assignment);
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
   * Validates the specificity override points to an available model before
   * using it. An orphaned override (e.g. a deleted custom provider) returns
   * null so resolve() falls through to tier-based routing instead of pinning
   * every matching request to a dead provider (#1603).
   */
  private async resolveSpecificityModel(
    agentId: string,
    assignment: { override_model: string | null; auto_assigned_model: string | null },
  ): Promise<string | null> {
    if (assignment.override_model !== null) {
      if (await this.providerKeyService.isModelAvailable(agentId, assignment.override_model)) {
        return assignment.override_model;
      }
      this.logger.warn(
        `Specificity override ${assignment.override_model} is unavailable ` +
          `for agent=${agentId}; falling through to tier routing`,
      );
      return null;
    }
    return assignment.auto_assigned_model;
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
