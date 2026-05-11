import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { AuthType, RequestParamDefaults } from 'manifest-shared';
import { AgentModelParams } from '../../entities/agent-model-params.entity';
import { RoutingCacheService } from './routing-cache.service';

/**
 * Per-(agent, route) outbound request body defaults. Replaces the legacy
 * per-slot `param_defaults` blobs on tier/specificity assignments: now
 * params travel with the route identity (provider, auth_type, model) so
 * one configuration applies anywhere the model is used.
 *
 * The proxy hits `get()` on every attempt, so the implementation reads
 * through a per-agent list cache (set once, served from memory for the
 * 2-minute TTL window). Misses are common — most models have no config —
 * so callers must treat `null` as the steady state, not an error.
 */
@Injectable()
export class AgentModelParamsService {
  constructor(
    @InjectRepository(AgentModelParams)
    private readonly repo: Repository<AgentModelParams>,
    private readonly cache: RoutingCacheService,
  ) {}

  /**
   * All param rows for an agent, served through the routing cache. Used by
   * the frontend (single fetch on Routing page boot) and by `get()` below
   * as the underlying read for per-attempt lookups.
   */
  async list(agentId: string): Promise<AgentModelParams[]> {
    const cached = this.cache.getModelParams(agentId);
    if (cached) return cached;
    const rows = await this.repo.find({ where: { agent_id: agentId } });
    this.cache.setModelParams(agentId, rows);
    return rows;
  }

  /**
   * Per-attempt lookup in the proxy hot path. Returns `null` when no row
   * exists for the route — the proxy should treat that as "use the
   * provider's natural default" and skip the merge.
   */
  async get(
    agentId: string,
    provider: string,
    authType: AuthType,
    modelName: string,
  ): Promise<RequestParamDefaults | null> {
    const rows = await this.list(agentId);
    const match = rows.find(
      (r) =>
        r.provider.toLowerCase() === provider.toLowerCase() &&
        r.auth_type === authType &&
        r.model_name === modelName,
    );
    return match?.params ?? null;
  }

  /**
   * Upsert one route's params. The unique index on (agent_id, provider,
   * auth_type, model_name) makes the upsert deterministic; callers do not
   * need to pre-check for existence.
   *
   * Cache is invalidated so the next `list()` / `get()` reads the new
   * value rather than the now-stale snapshot. Eager re-fetch is not worth
   * the round-trip — the next request will warm the cache on demand.
   */
  async set(
    agentId: string,
    userId: string,
    provider: string,
    authType: AuthType,
    modelName: string,
    params: RequestParamDefaults,
  ): Promise<AgentModelParams> {
    const existing = await this.repo.findOne({
      where: {
        agent_id: agentId,
        provider: provider.toLowerCase(),
        auth_type: authType,
        model_name: modelName,
      },
    });
    if (existing) {
      existing.params = params;
      const saved = await this.repo.save(existing);
      this.cache.invalidateModelParams(agentId);
      return saved;
    }
    const row = this.repo.create({
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider: provider.toLowerCase(),
      auth_type: authType,
      model_name: modelName,
      params,
    });
    const saved = await this.repo.save(row);
    this.cache.invalidateModelParams(agentId);
    return saved;
  }

  /**
   * Drop one route's params entirely. The next proxy attempt will use the
   * provider's natural default. Idempotent — deleting a non-existent row
   * is a no-op so the controller can call this without a pre-check.
   */
  async delete(
    agentId: string,
    provider: string,
    authType: AuthType,
    modelName: string,
  ): Promise<void> {
    await this.repo.delete({
      agent_id: agentId,
      provider: provider.toLowerCase(),
      auth_type: authType,
      model_name: modelName,
    });
    this.cache.invalidateModelParams(agentId);
  }
}
