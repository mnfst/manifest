import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IncomingHttpHeaders } from 'http';
import { TierService } from '../routing-core/tier.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { RoutingCacheService } from '../routing-core/routing-cache.service';
import { SpecificityService } from '../routing-core/specificity.service';
import { SpecificityPenaltyService } from '../routing-core/specificity-penalty.service';
import { HeaderTierService } from '../header-tiers/header-tier.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { readFallbackRoutes, readOverrideRoute } from '../routing-core/route-helpers';
import { effectiveRoutesForResponseMode } from '../routing-core/response-mode-guard';
import { scoreRequest, ScorerInput, MomentumInput, scanMessages } from '../../scoring';
import { ResolveResponse } from '../dto/resolve-response';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { Agent } from '../../entities/agent.entity';
import { DEFAULT_RESPONSE_MODE, DEFAULT_OUTPUT_MODALITY } from 'manifest-shared';
import type {
  AuthType,
  ModelRoute,
  ResponseMode,
  OutputModality,
  SpecificityCategory,
  TierSlot,
} from 'manifest-shared';
import type { HeaderTier } from '../../entities/header-tier.entity';
import type { TierAssignment } from '../../entities/tier-assignment.entity';
import type { SpecificityAssignment } from '../../entities/specificity-assignment.entity';

interface ResolvedRouteChain {
  primaryRoute: ModelRoute | null;
  fallbackRoutes: ModelRoute[] | null;
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
    private readonly headerTierService: HeaderTierService,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly routingCache: RoutingCacheService,
  ) {
    // Bridge the central routing-cache invalidation to the discovered-model
    // cache. Every provider mutation already calls routingCache.invalidateAgent;
    // forwarding it here keeps ModelDiscoveryService's per-agent model cache
    // fresh without a cross-module dependency (which would cycle).
    this.routingCache.addInvalidationListener((agentId) =>
      this.discoveryService.invalidate(agentId),
    );
  }

  async resolve(
    agentId: string,
    messages: ScorerInput['messages'],
    tools?: ScorerInput['tools'],
    toolChoice?: unknown,
    maxTokens?: number,
    recentTiers?: MomentumInput['recentTiers'],
    specificityOverride?: string,
    recentCategories?: readonly SpecificityCategory[],
    headers?: IncomingHttpHeaders,
  ): Promise<ResolveResponse> {
    if (headers) {
      const headerTierResult = await this.resolveHeaderTier(agentId, headers);
      if (headerTierResult) return headerTierResult;
    }

    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (agent && !agent.complexity_routing_enabled) {
      return this.resolveForTier(agentId, 'default', 'default');
    }

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

    const result = scoreRequest(input, undefined, momentum);

    const tiers = await this.tierService.getTiers(agentId);
    const assignment = tiers.find((t) => t.tier === result.tier);

    if (!assignment) {
      this.logger.warn(
        `No tier assignment found for agent=${agentId} tier=${result.tier} ` +
          `(available tiers: ${tiers.map((t) => t.tier).join(', ') || 'none'})`,
      );
      // Final catch-all: fall back to the default tier so the request still
      // resolves a model instead of 500ing when a scored tier is missing.
      return this.resolveForTier(agentId, 'default', 'default');
    }

    const outputModality = outputModalityFor(assignment);
    const responseMode = responseModeFor(assignment);
    const fallbackRoutes = readFallbackRoutes(assignment);
    const routeChain = await this.buildResolvedRouteChain(agentId, assignment, fallbackRoutes);
    const effectiveRoutes = effectiveRoutesForResponseMode(
      responseMode,
      routeChain.primaryRoute,
      routeChain.fallbackRoutes,
    );
    if (!effectiveRoutes.primaryRoute) {
      this.logger.warn(
        `No route resolved for agent=${agentId} tier=${result.tier} ` +
          `(override=${assignment.override_route?.model ?? 'null'} ` +
          `auto=${assignment.auto_assigned_route?.model ?? 'null'})`,
      );
      return {
        tier: result.tier,
        route: null,
        fallback_routes: effectiveRoutes.fallbackRoutes,
        output_modality: outputModality,
        response_mode: responseMode,
        confidence: result.confidence,
        score: result.score,
        reason: result.reason,
      };
    }

    return {
      tier: result.tier,
      route: effectiveRoutes.primaryRoute,
      fallback_routes: effectiveRoutes.fallbackRoutes,
      output_modality: outputModality,
      response_mode: responseMode,
      confidence: result.confidence,
      score: result.score,
      reason: result.reason,
    };
  }

  async resolveForTier(
    agentId: string,
    tier: TierSlot,
    reason: 'heartbeat' | 'default' = 'heartbeat',
  ): Promise<ResolveResponse> {
    const tiers = await this.tierService.getTiers(agentId);
    const assignment = tiers.find((t) => t.tier === tier);

    if (!assignment) {
      return {
        tier,
        route: null,
        fallback_routes: null,
        output_modality: DEFAULT_OUTPUT_MODALITY,
        response_mode: DEFAULT_RESPONSE_MODE,
        confidence: 1,
        score: 0,
        reason,
      };
    }

    const outputModality = outputModalityFor(assignment);
    const responseMode = responseModeFor(assignment);
    const fallbackRoutes = readFallbackRoutes(assignment);
    const routeChain = await this.buildResolvedRouteChain(agentId, assignment, fallbackRoutes);
    const effectiveRoutes = effectiveRoutesForResponseMode(
      responseMode,
      routeChain.primaryRoute,
      routeChain.fallbackRoutes,
    );
    return {
      tier,
      route: effectiveRoutes.primaryRoute,
      fallback_routes: effectiveRoutes.fallbackRoutes,
      output_modality: outputModality,
      response_mode: responseMode,
      confidence: 1,
      score: 0,
      reason,
    };
  }

  private async resolveHeaderTier(
    agentId: string,
    headers: IncomingHttpHeaders,
  ): Promise<ResolveResponse | null> {
    const allTiers = await this.headerTierService.list(agentId);
    const tiers = allTiers.filter((t) => t.enabled);
    if (tiers.length === 0) return null;

    const match = tiers.find((t) => matchesHeaderRule(headers, t));
    if (!match) return null;

    const overrideRoute = readOverrideRoute(match);
    if (!overrideRoute) {
      this.logger.debug(
        `Header tier "${match.name}" matched but has no model configured — falling through`,
      );
      return null;
    }

    // Guard against orphaned overrides (a model removed after the tier was
    // configured). Mirrors the same check in resolveSpecificity().
    if (!(await this.providerKeyService.isModelAvailable(agentId, overrideRoute.model))) {
      this.logger.warn(
        `Header tier "${match.name}" override ${overrideRoute.model} is unavailable ` +
          `for agent=${agentId}; falling through to existing routing`,
      );
      return null;
    }

    const provider =
      overrideRoute.provider || (await this.resolveProviderForModel(agentId, overrideRoute.model));
    const authType: AuthType =
      overrideRoute.authType ??
      (await this.providerKeyService.getAuthType(agentId, provider ?? ''));
    const baseRoute: ModelRoute | null =
      provider && authType
        ? { provider, authType, model: overrideRoute.model, keyLabel: overrideRoute.keyLabel }
        : null;
    const route = baseRoute ? await this.enrichRouteKeyLabel(agentId, baseRoute) : null;

    const outputModality = outputModalityFor(match);
    const responseMode = responseModeFor(match);
    const fallbackRoutes = readFallbackRoutes(match);
    const effectiveRoutes = effectiveRoutesForResponseMode(responseMode, route, fallbackRoutes);

    return {
      tier: 'standard',
      route: effectiveRoutes.primaryRoute,
      fallback_routes: effectiveRoutes.fallbackRoutes,
      output_modality: outputModality,
      response_mode: responseMode,
      confidence: 1,
      score: 0,
      reason: 'header-match',
      header_tier_id: match.id,
      header_tier_name: match.name,
      header_tier_color: match.badge_color,
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

    const overrideRoute = readOverrideRoute(assignment);
    let route: ModelRoute | null;
    if (overrideRoute) {
      // Validate the override still points to an available model. An orphaned
      // override (e.g. a deleted custom provider) returns null so resolve()
      // falls through to tier-based routing instead of pinning every matching
      // request to a dead provider (#1603).
      if (!(await this.providerKeyService.isModelAvailable(agentId, overrideRoute.model))) {
        this.logger.warn(
          `Specificity override ${overrideRoute.model} is unavailable ` +
            `for agent=${agentId}; falling through to tier routing`,
        );
        return null;
      }
      route = overrideRoute;
    } else if (assignment.auto_assigned_route) {
      route = assignment.auto_assigned_route;
    } else {
      return null;
    }

    const outputModality = outputModalityFor(assignment);
    const responseMode = responseModeFor(assignment);
    const fallbackRoutes = readFallbackRoutes(assignment);
    const enrichedRoute = await this.enrichRouteKeyLabel(agentId, route);
    const effectiveRoutes = effectiveRoutesForResponseMode(
      responseMode,
      enrichedRoute,
      fallbackRoutes,
    );

    return {
      tier: 'standard',
      route: effectiveRoutes.primaryRoute,
      fallback_routes: effectiveRoutes.fallbackRoutes,
      output_modality: outputModality,
      response_mode: responseMode,
      confidence: detected.confidence,
      score: 0,
      reason: 'specificity',
      specificity_category: detected.category,
    };
  }

  /**
   * Build the resolved route chain for a tier assignment. Validates the
   * override still points to an available model; when an override is orphaned,
   * walk configured fallbacks before trying the auto-assigned route. Enriches
   * routes with the default key label when no explicit pin is present.
   */
  private async buildResolvedRouteChain(
    agentId: string,
    assignment: TierAssignment | SpecificityAssignment,
    fallbackRoutes: ModelRoute[] | null,
  ): Promise<ResolvedRouteChain> {
    const override = readOverrideRoute(assignment);
    if (override) {
      if (await this.providerKeyService.isModelAvailable(agentId, override.model)) {
        return {
          primaryRoute: await this.enrichRouteKeyLabel(agentId, override),
          fallbackRoutes,
        };
      }
      this.logger.warn(
        `Override ${override.model} unavailable for agent=${agentId} — ` +
          `falling back to configured routes`,
      );
      const candidates = [
        ...(fallbackRoutes ?? []),
        ...(assignment.auto_assigned_route ? [assignment.auto_assigned_route] : []),
      ];
      const [primaryRoute, ...remainingFallbacks] = candidates;
      return {
        primaryRoute: primaryRoute ? await this.enrichRouteKeyLabel(agentId, primaryRoute) : null,
        fallbackRoutes: remainingFallbacks.length > 0 ? remainingFallbacks : null,
      };
    }
    return {
      primaryRoute: assignment.auto_assigned_route
        ? await this.enrichRouteKeyLabel(agentId, assignment.auto_assigned_route)
        : null,
      fallbackRoutes,
    };
  }

  /**
   * Fill in `route.keyLabel` from the agent's default (priority-0) key for
   * (route.provider, route.authType) when the route doesn't already pin a
   * specific label. The proxy needs a concrete keyLabel to pick the right
   * row in `user_providers`; without this, multi-key users would always hit
   * the first key, ignoring per-tier pins set on auto-assigned routes.
   *
   * authType is taken from the route itself (not from any assignment-level
   * legacy field), so this can't accidentally use the override's authType
   * for an auto-assigned model picked under a different auth mode.
   */
  private async enrichRouteKeyLabel(agentId: string, route: ModelRoute): Promise<ModelRoute> {
    if (route.keyLabel) return route;
    const label = await this.providerKeyService.getDefaultKeyLabel(
      agentId,
      route.provider,
      route.authType,
    );
    return label ? { ...route, keyLabel: label } : route;
  }

  /**
   * Resolve provider for a model that has no explicit provider attached
   * (e.g. legacy header-tier rows where override_route was backfilled with
   * just the model). Used as a fallback only.
   */
  private async resolveProviderForModel(agentId: string, model: string): Promise<string | null> {
    // 1. Slash prefix on the model name when that provider is connected.
    const prefix = inferProviderFromModelName(model);
    if (prefix && (await this.providerKeyService.hasActiveProvider(agentId, prefix))) {
      return prefix;
    }
    // 2. Discovered models cache.
    const discovered = await this.discoveryService.getModelForAgent(agentId, model);
    if (discovered) return discovered.provider;
    // 3. Pricing cache (excluding the OpenRouter aggregator).
    const pricing = this.pricingCache.getByModel(model);
    if (pricing && pricing.provider !== 'OpenRouter') return pricing.provider;
    return null;
  }
}

function matchesHeaderRule(headers: IncomingHttpHeaders, tier: HeaderTier): boolean {
  const raw = headers[tier.header_key];
  if (raw == null) return false;
  // Node gives repeated headers as string[]; match if any entry equals the rule.
  if (Array.isArray(raw)) return raw.some((v) => v === tier.header_value);
  return raw === tier.header_value;
}

function outputModalityFor(row: { output_modality?: OutputModality | null }): OutputModality {
  return row.output_modality ?? DEFAULT_OUTPUT_MODALITY;
}

function responseModeFor(row: { response_mode?: ResponseMode | null }): ResponseMode {
  return row.response_mode ?? DEFAULT_RESPONSE_MODE;
}
