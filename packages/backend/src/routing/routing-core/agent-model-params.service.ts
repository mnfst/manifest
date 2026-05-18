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
    return (match?.params as RequestParamDefaults | undefined) ?? null;
  }

  /**
   * Atomic upsert for one route's params. The unique index on (agent_id,
   * provider, auth_type, model_name) drives the ON CONFLICT clause so two
   * concurrent writes for the same route resolve deterministically instead
   * of racing on `findOne` + `save` and failing one with a duplicate-key
   * error.
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
    const normalizedProvider = provider.toLowerCase();
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(AgentModelParams)
      .values({
        id: randomUUID(),
        user_id: userId,
        agent_id: agentId,
        provider: normalizedProvider,
        auth_type: authType,
        model_name: modelName,
        params,
      })
      .orUpdate(['params', 'updated_at'], ['agent_id', 'provider', 'auth_type', 'model_name'])
      .setParameter('updated_at', new Date().toISOString())
      .execute();
    this.cache.invalidateModelParams(agentId);
    // The QueryBuilder's INSERT … ON CONFLICT path doesn't return the row
    // shape we need (Postgres' RETURNING is partial when ON CONFLICT
    // triggers an UPDATE that doesn't actually change every column), so
    // re-fetch via the route's unique index. One round-trip; the cache was
    // just invalidated so callers see the fresh value on their next
    // list()/get().
    const row = await this.repo.findOneOrFail({
      where: {
        agent_id: agentId,
        provider: normalizedProvider,
        auth_type: authType,
        model_name: modelName,
      },
    });
    return row;
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
