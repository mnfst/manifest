import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { ProviderService } from './provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { randomUUID } from 'crypto';
import type { AuthType, ModelRoute, ResponseMode } from 'manifest-shared';
import {
  DEFAULT_RESPONSE_MODE,
  DEFAULT_OUTPUT_MODALITY,
  TIER_SLOTS,
  TierSlot,
} from 'manifest-shared';
import { isManifestUsableProvider } from '../../common/utils/subscription-support';
import { explicitRoute, unambiguousRoute, routeMatches } from './route-helpers';
import { assertStreamableResponseMode } from './response-mode-guard';

@Injectable()
export class TierService {
  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    private readonly autoAssign: TierAutoAssignService,
    private readonly routingCache: RoutingCacheService,
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async hasRoutableTier(agentId: string): Promise<boolean> {
    const rows = await this.tierRepo.find({ where: { agent_id: agentId } });
    return rows.some((r) => !!r.override_route || !!r.auto_assigned_route);
  }

  async getTiers(agentId: string, userId?: string): Promise<TierAssignment[]> {
    const cached = this.routingCache.getTiers(agentId);
    if (cached) return cached;

    // Trigger provider cleanup to deactivate unsupported subscription providers
    await this.providerService.getProviders(agentId);
    const rows = await this.tierRepo.find({ where: { agent_id: agentId } });

    // Figure out which slots are missing. Every agent should have a row for
    // each slot in TIER_SLOTS (4 scoring tiers + 'default'). If a previous
    // boot or older migration created a subset, fill the gaps instead of
    // throwing on the unique index.
    const present = new Set(rows.map((r) => r.tier));
    const missing = TIER_SLOTS.filter((slot) => !present.has(slot));

    if (missing.length === 0) {
      this.routingCache.setTiers(agentId, rows);
      return rows;
    }

    const created: TierAssignment[] = missing.map((slot: TierSlot) =>
      Object.assign(new TierAssignment(), {
        id: randomUUID(),
        user_id: userId ?? '',
        agent_id: agentId,
        tier: slot,
        override_route: null,
        auto_assigned_route: null,
        fallback_routes: null,
        output_modality: DEFAULT_OUTPUT_MODALITY,
        response_mode: DEFAULT_RESPONSE_MODE,
      }),
    );
    try {
      await this.tierRepo.insert(created);
    } catch (err) {
      // A concurrent request may have inserted the same slots first, which
      // hits the unique (agent_id, tier) index. Re-read and adopt its rows
      // if present; otherwise the failure is something else (FK violation,
      // connection error, …) and we rethrow rather than silently proceed.
      const existing = await this.tierRepo.find({ where: { agent_id: agentId } });
      if (existing.length > 0) {
        this.routingCache.setTiers(agentId, existing);
        return existing;
      }
      throw err;
    }

    // If agent has active providers, recalculate so new slots get auto-assigned models.
    const providers = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });
    const usableProviders = providers.filter(isManifestUsableProvider);
    if (usableProviders.length > 0) {
      await this.autoAssign.recalculate(agentId);
      const result = await this.tierRepo.find({ where: { agent_id: agentId } });
      this.routingCache.setTiers(agentId, result);
      return result;
    }

    const merged = [...rows, ...created];
    this.routingCache.setTiers(agentId, merged);
    return merged;
  }

  async setOverride(
    agentId: string,
    userId: string,
    tier: string,
    model: string,
    provider?: string,
    authType?: AuthType,
    providerKeyLabel?: string,
  ): Promise<TierAssignment> {
    const available = await this.discoveryService.getModelsForAgent(agentId);
    const matches = available.filter((m) => m.id === model);
    if (matches.length === 0) {
      const providerHint = provider ? ` (provider: ${provider})` : '';
      const options = available.map((m) => m.id).slice(0, 20);
      throw new BadRequestException(
        `Model "${model}" is not in this agent's discovered model list${providerHint}. ` +
          `Connect the appropriate provider first, or choose from: ${options.join(', ')}${
            available.length > options.length ? ', …' : ''
          }`,
      );
    }
    if (provider) {
      const providerLower = provider.toLowerCase();
      const providerMatches = matches.some((m) => m.provider.toLowerCase() === providerLower);
      if (!providerMatches) {
        throw new BadRequestException(
          `Model "${model}" is not offered by provider "${provider}" for this agent.`,
        );
      }
    }

    // Build the route. Prefer the explicit triple if the caller passed it,
    // otherwise resolve from discovery. Throw on ambiguous because we have
    // no legacy column to fall back to anymore — the caller must disambiguate.
    const route =
      explicitRoute(model, provider, authType, providerKeyLabel) ??
      unambiguousRoute(model, available, providerKeyLabel);
    if (!route) {
      throw new BadRequestException(
        `Model "${model}" is offered by multiple providers — pass an explicit ` +
          `provider + authType so the route is unambiguous.`,
      );
    }

    const existing = await this.tierRepo.findOne({
      where: { agent_id: agentId, tier },
    });

    if (existing) {
      existing.override_route = route;
      // If the same model+key tuple was in fallbacks, drop the matching entry
      // — a (model, keyLabel) can't be both the primary and a fallback for
      // the same tier. Other (model, otherKey) fallbacks are kept.
      if (existing.fallback_routes) {
        const filtered = existing.fallback_routes.filter((r) => !routeMatches(r, route));
        existing.fallback_routes = filtered.length > 0 ? filtered : null;
      }
      assertStreamableResponseMode(
        existing.response_mode,
        `tier "${tier}"`,
        route,
        existing.fallback_routes,
      );
      existing.updated_at = new Date().toISOString();
      await this.tierRepo.save(existing);
      this.routingCache.invalidateAgent(agentId);
      return existing;
    }

    const record: TierAssignment = Object.assign(new TierAssignment(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      tier,
      override_route: route,
      auto_assigned_route: null,
      fallback_routes: null,
      output_modality: DEFAULT_OUTPUT_MODALITY,
      response_mode: DEFAULT_RESPONSE_MODE,
    });

    try {
      await this.tierRepo.insert(record);
    } catch {
      const retry = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
      if (retry)
        return this.setOverride(agentId, userId, tier, model, provider, authType, providerKeyLabel);
    }
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async setResponseMode(
    agentId: string,
    userId: string,
    tier: string,
    responseMode: ResponseMode,
  ): Promise<TierAssignment> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (existing) {
      assertStreamableResponseMode(
        responseMode,
        `tier "${tier}"`,
        existing.override_route ?? existing.auto_assigned_route,
        existing.fallback_routes,
      );
      existing.response_mode = responseMode;
      existing.updated_at = new Date().toISOString();
      await this.tierRepo.save(existing);
      this.routingCache.invalidateAgent(agentId);
      return existing;
    }

    const record: TierAssignment = Object.assign(new TierAssignment(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      tier,
      override_route: null,
      auto_assigned_route: null,
      fallback_routes: null,
      output_modality: DEFAULT_OUTPUT_MODALITY,
      response_mode: responseMode,
    });
    assertStreamableResponseMode(responseMode, `tier "${tier}"`, null, null);
    await this.tierRepo.insert(record);
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async clearOverride(agentId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({
      where: { agent_id: agentId, tier },
    });
    if (!existing) return;

    existing.override_route = null;
    assertStreamableResponseMode(
      existing.response_mode,
      `tier "${tier}"`,
      existing.auto_assigned_route,
      existing.fallback_routes,
    );
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  async resetAllOverrides(agentId: string): Promise<void> {
    await this.tierRepo.update(
      { agent_id: agentId },
      {
        override_route: null,
        fallback_routes: null,
        updated_at: new Date().toISOString(),
      },
    );
    this.routingCache.invalidateAgent(agentId);
  }

  /* ── Fallbacks ── */

  async getFallbacks(agentId: string, tier: string): Promise<ModelRoute[]> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    return existing?.fallback_routes ?? [];
  }

  async setFallbacks(
    agentId: string,
    tier: string,
    models: string[],
    routes?: ModelRoute[],
  ): Promise<ModelRoute[]> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (!existing) return [];
    const fallbackRoutes = await this.buildFallbackRoutes(agentId, models, routes);
    assertStreamableResponseMode(
      existing.response_mode,
      `tier "${tier}"`,
      existing.override_route ?? existing.auto_assigned_route,
      fallbackRoutes,
    );
    existing.fallback_routes = fallbackRoutes;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
    return existing.fallback_routes ?? [];
  }

  async clearFallbacks(agentId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (!existing) return;
    assertStreamableResponseMode(
      existing.response_mode,
      `tier "${tier}"`,
      existing.override_route ?? existing.auto_assigned_route,
      null,
    );
    existing.fallback_routes = null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  /**
   * Build the fallback_routes column from caller-provided routes when present,
   * otherwise resolve each model name via discovery. Order is preserved.
   *
   * Throws BadRequestException when any model can't be resolved to a single
   * (provider, authType, model) tuple — the caller's existing
   * `fallback_routes` row is left untouched.
   *
   * Issue #1790: this used to `return null` on resolution failure, which
   * `setFallbacks` then persisted, silently wiping the user's existing
   * fallback list while the UI toasted "Fallback added". PR #1825 plugged
   * the most common trigger (same model offered by two authTypes) by making
   * the frontend send routes; throwing here removes the underlying wipe path
   * for every other trigger (e.g. disconnected providers, discovery drift,
   * malformed payloads). It does not narrow which inputs reach this path.
   *
   * `keyLabel` on each route is preserved as-is — the caller decides which
   * provider key each fallback pins to.
   */
  private async buildFallbackRoutes(
    agentId: string,
    models: string[],
    routes?: ModelRoute[],
  ): Promise<ModelRoute[] | null> {
    if (models.length === 0) return null;
    const available = await this.discoveryService.getModelsForAgent(agentId);
    if (routes && routes.length === models.length) {
      const aligned = routes.every((r, i) => r.model === models[i]);
      // Cross-check each caller-provided route against the discovered model
      // list — a (provider, authType, model) tuple is only safe to persist
      // if it actually corresponds to a connected provider that offers the
      // model. Without this, a malformed payload could write a route that
      // would later route to non-existent credentials. keyLabel is not
      // validated here against the provider key set — that lives in
      // ProviderService.cleanupProviderReferences and runs on every
      // provider mutation.
      const validated =
        aligned &&
        routes.every((r) =>
          available.some(
            (m) =>
              m.id === r.model &&
              m.provider.toLowerCase() === r.provider.toLowerCase() &&
              m.authType === r.authType,
          ),
        );
      if (validated) return routes;
    }
    const resolved: ModelRoute[] = [];
    for (const m of models) {
      const route = unambiguousRoute(m, available);
      if (!route) {
        throw new BadRequestException(
          `Cannot resolve fallback model "${m}" to a single connected provider. ` +
            `Pass an explicit (provider, authType, model) route, or connect exactly one provider that offers this model.`,
        );
      }
      resolved.push(route);
    }
    return resolved;
  }
}
