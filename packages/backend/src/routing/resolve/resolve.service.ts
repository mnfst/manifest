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
import {
  readAutoAssignedRoute,
  readFallbackRoutes,
  readOverrideRoute,
} from '../routing-core/route-helpers';
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
    tenantId: string,
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
      const headerTierResult = await this.resolveHeaderTier(agentId, tenantId, headers);
      if (headerTierResult) return headerTierResult;
    }

    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (agent && !agent.complexity_routing_enabled) {
      return this.resolveForTier(agentId, tenantId, 'default', 'default');
    }

    const specificityResult = await this.resolveSpecificity(
      agentId,
      tenantId,
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
      return this.resolveForTier(agentId, tenantId, 'default', 'default');
    }

    const outputModality = outputModalityFor(assignment);
    const responseMode = responseModeFor(assignment);
    const fallbackRoutes = readFallbackRoutes(assignment);
    const routeChain = await this.buildResolvedRouteChain(
      agentId,
      tenantId,
      assignment,
      fallbackRoutes,
    );
    const effectiveRoutes = effectiveRoutesForResponseMode(
      responseMode,
      routeChain.primaryRoute,
      routeChain.fallbackRoutes,
    );
    if (!effectiveRoutes.primaryRoute) {
      this.logger.warn(
        `No route resolved for agent=${agentId} tier=${result.tier} ` +
          `(override=${assignment.override_route?.model ?? 'null'})`,
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
    tenantId: string,
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
    const routeChain = await this.buildResolvedRouteChain(
      agentId,
      tenantId,
      assignment,
      fallbackRoutes,
    );
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

  /**
   * Public so the proxy can apply header tiers ahead of an explicit `model` in
   * the request body: a header rule is a deliberate override the operator
   * configured, and it outranks the model an SDK happens to name.
   *
   * Returns null when no rule matches, and when the matched rule has no
   * available route — both mean "keep looking".
   */
  async resolveHeaderTier(
    agentId: string,
    tenantId: string,
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
    // configured). The route-aware check honors the override's pinned
    // (provider, authType) so a model id shared by two connections — e.g.
    // openai api_key + openai subscription both exposing gpt-5.5 — still
    // counts as available (#2210).
    const fallbackRoutes = readFallbackRoutes(match);
    let primaryOverride: ModelRoute | null = overrideRoute;
    let remainingFallbacks: ModelRoute[] | null = fallbackRoutes;
    if (!(await this.providerKeyService.isRouteAvailable(tenantId, overrideRoute, agentId))) {
      // An explicitly configured tier shouldn't die with its primary: promote
      // the first available fallback instead of abandoning the whole tier.
      this.logger.warn(
        `Header tier "${match.name}" override ${overrideRoute.model} is unavailable ` +
          `for agent=${agentId} — trying the tier's fallbacks`,
      );
      primaryOverride = null;
      const candidates = fallbackRoutes ?? [];
      for (let i = 0; i < candidates.length; i++) {
        if (await this.providerKeyService.isRouteAvailable(tenantId, candidates[i], agentId)) {
          primaryOverride = candidates[i];
          const rest = candidates.slice(i + 1);
          remainingFallbacks = rest.length > 0 ? rest : null;
          break;
        }
      }
      if (!primaryOverride) {
        this.logger.warn(
          `Header tier "${match.name}" has no available route ` +
            `for agent=${agentId}; falling through to existing routing`,
        );
        return null;
      }
    }

    const provider =
      primaryOverride.provider ||
      (await this.resolveProviderForModel(agentId, tenantId, primaryOverride.model));
    const authType: AuthType =
      primaryOverride.authType ??
      (await this.providerKeyService.getAuthType(tenantId, provider ?? '', undefined, agentId));
    const baseRoute: ModelRoute | null =
      provider && authType
        ? { provider, authType, model: primaryOverride.model, keyLabel: primaryOverride.keyLabel }
        : null;
    const route = baseRoute ? await this.enrichRouteKeyLabel(agentId, tenantId, baseRoute) : null;

    const outputModality = outputModalityFor(match);
    const responseMode = responseModeFor(match);
    const effectiveRoutes = effectiveRoutesForResponseMode(responseMode, route, remainingFallbacks);

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
    tenantId: string,
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
      // request to a dead provider (#1603). Route-aware so a pinned
      // (provider, authType) survives duplicate model ids (#2210).
      if (!(await this.providerKeyService.isRouteAvailable(tenantId, overrideRoute, agentId))) {
        this.logger.warn(
          `Specificity override ${overrideRoute.model} is unavailable ` +
            `for agent=${agentId}; falling through to tier routing`,
        );
        return null;
      }
      route = overrideRoute;
    } else {
      return null;
    }

    const outputModality = outputModalityFor(assignment);
    const responseMode = responseModeFor(assignment);
    const fallbackRoutes = readFallbackRoutes(assignment);
    const enrichedRoute = await this.enrichRouteKeyLabel(agentId, tenantId, route);
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
   * Build the resolved route chain for a tier assignment. Explicit overrides
   * retain the full model-aware availability check. Automatic and fallback
   * candidates use the provider-key cache instead: the proxy needs the same
   * key before forwarding, so this prevents stale disconnected providers from
   * becoming primary without adding a separate model-discovery query to the
   * gateway path. When nothing has usable credentials, the proxy gets a null
   * route and returns the neutral M101 instead of M100 (#2494).
   */
  private async buildResolvedRouteChain(
    agentId: string,
    tenantId: string,
    assignment: TierAssignment | SpecificityAssignment,
    fallbackRoutes: ModelRoute[] | null,
  ): Promise<ResolvedRouteChain> {
    const override = readOverrideRoute(assignment);
    // Legacy reads go through the shared helper so the "auto_assigned_route is
    // honored when override is empty" semantics stay in lockstep with
    // TierService.hasRoutableTier / effectiveRoute (see route-helpers.ts).
    const autoAssigned = readAutoAssignedRoute(assignment);

    if (override && (await this.providerKeyService.isRouteAvailable(tenantId, override, agentId))) {
      return {
        primaryRoute: await this.enrichRouteKeyLabel(agentId, tenantId, override),
        fallbackRoutes,
      };
    }
    if (override) {
      this.logger.warn(
        `Override ${override.model} unavailable for agent=${agentId} — ` +
          `falling back to configured routes`,
      );
    }

    // An orphaned override walks its fallbacks before the legacy auto-assigned
    // route; a tier with no override starts from the auto-assigned route.
    const candidates = override
      ? [...(fallbackRoutes ?? []), ...(autoAssigned ? [autoAssigned] : [])]
      : [...(autoAssigned ? [autoAssigned] : []), ...(fallbackRoutes ?? [])];
    for (let i = 0; i < candidates.length; i++) {
      if (await this.providerKeyService.hasRouteCredentials(tenantId, candidates[i], agentId)) {
        const rest = candidates.slice(i + 1);
        return {
          primaryRoute: await this.enrichRouteKeyLabel(agentId, tenantId, candidates[i]),
          fallbackRoutes: rest.length > 0 ? rest : null,
        };
      }
    }
    return { primaryRoute: null, fallbackRoutes: null };
  }

  /**
   * Fill in `route.keyLabel` from the tenant's default (priority-0) key for
   * (route.provider, route.authType) when the route doesn't already pin a
   * specific label. The proxy needs a concrete keyLabel to pick the right row
   * in `tenant_providers`; without this, multi-key users would always hit the
   * first key instead of the default key for the selected auth mode.
   *
   * authType is taken from the route itself, not from any assignment-level
   * legacy field.
   */
  private async enrichRouteKeyLabel(
    agentId: string,
    tenantId: string,
    route: ModelRoute,
  ): Promise<ModelRoute> {
    if (route.keyLabel) return route;
    const label = await this.providerKeyService.getDefaultKeyLabel(
      tenantId,
      route.provider,
      route.authType,
      agentId,
    );
    return label ? { ...route, keyLabel: label } : route;
  }

  /**
   * Resolve provider for a model that has no explicit provider attached
   * (e.g. legacy header-tier rows where override_route was backfilled with
   * just the model). Used as a fallback only.
   */
  private async resolveProviderForModel(
    agentId: string,
    tenantId: string,
    model: string,
  ): Promise<string | null> {
    // 1. Slash prefix on the model name when that provider is connected.
    const prefix = inferProviderFromModelName(model);
    if (prefix && (await this.providerKeyService.hasActiveProvider(tenantId, prefix, agentId))) {
      return prefix;
    }
    // 2. Discovered models cache.
    const discovered = await this.discoveryService.getModelForAgent(tenantId, model, agentId);
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
