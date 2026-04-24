import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { ProviderService } from './provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { randomUUID } from 'crypto';
import { TIER_SLOTS, TierSlot } from 'manifest-shared';
import { isManifestUsableProvider } from '../../common/utils/subscription-support';

@Injectable()
export class TierService {
  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly autoAssign: TierAutoAssignService,
    private readonly routingCache: RoutingCacheService,
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async hasRoutableTier(agentId: string): Promise<boolean> {
    const rows = await this.tierRepo.find({ where: { agent_id: agentId } });
    return rows.some((r) => !!r.override_model || !!r.auto_assigned_model);
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
        override_model: null,
        override_provider: null,
        override_auth_type: null,
        auto_assigned_model: null,
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

  async isComplexityEnabled(agentId: string): Promise<boolean> {
    const cached = this.routingCache.getComplexityEnabled(agentId);
    if (cached !== undefined) return cached;
    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
      select: ['id', 'complexity_routing_enabled'],
    });
    const enabled = agent?.complexity_routing_enabled ?? false;
    this.routingCache.setComplexityEnabled(agentId, enabled);
    return enabled;
  }

  async setComplexityEnabled(agentId: string, enabled: boolean): Promise<void> {
    await this.agentRepo.update({ id: agentId }, { complexity_routing_enabled: enabled });
    this.routingCache.invalidateAgent(agentId);
  }

  async setOverride(
    agentId: string,
    userId: string,
    tier: string,
    model: string,
    provider?: string,
    authType?: 'api_key' | 'subscription',
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
    // If provider is supplied, ensure it matches one of the available entries.
    if (provider) {
      const providerLower = provider.toLowerCase();
      const providerMatches = matches.some((m) => m.provider.toLowerCase() === providerLower);
      if (!providerMatches) {
        throw new BadRequestException(
          `Model "${model}" is not offered by provider "${provider}" for this agent.`,
        );
      }
    }

    const existing = await this.tierRepo.findOne({
      where: { agent_id: agentId, tier },
    });

    if (existing) {
      existing.override_model = model;
      existing.override_provider = provider ?? null;
      existing.override_auth_type = authType ?? null;
      if (existing.fallback_models?.includes(model)) {
        const filtered = existing.fallback_models.filter((m) => m !== model);
        existing.fallback_models = filtered.length > 0 ? filtered : null;
      }
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
      override_model: model,
      override_provider: provider ?? null,
      override_auth_type: authType ?? null,
      auto_assigned_model: null,
    });

    try {
      await this.tierRepo.insert(record);
    } catch {
      // Concurrent insert — retry as update
      const retry = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
      if (retry) return this.setOverride(agentId, userId, tier, model, provider, authType);
    }
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async clearOverride(agentId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({
      where: { agent_id: agentId, tier },
    });
    if (!existing) return;

    existing.override_model = null;
    existing.override_provider = null;
    existing.override_auth_type = null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  async resetAllOverrides(agentId: string): Promise<void> {
    await this.tierRepo.update(
      { agent_id: agentId },
      {
        override_model: null,
        override_provider: null,
        override_auth_type: null,
        fallback_models: null,
        updated_at: new Date().toISOString(),
      },
    );
    this.routingCache.invalidateAgent(agentId);
  }

  /* ── Fallbacks ── */

  async getFallbacks(agentId: string, tier: string): Promise<string[]> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    return existing?.fallback_models ?? [];
  }

  async setFallbacks(agentId: string, tier: string, models: string[]): Promise<string[]> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (!existing) return [];
    existing.fallback_models = models.length > 0 ? models : null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
    return models;
  }

  async clearFallbacks(agentId: string, tier: string): Promise<void> {
    const existing = await this.tierRepo.findOne({ where: { agent_id: agentId, tier } });
    if (!existing) return;
    existing.fallback_models = null;
    existing.updated_at = new Date().toISOString();
    await this.tierRepo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }
}
