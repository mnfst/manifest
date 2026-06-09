import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Agent } from '../entities/agent.entity';
import { TenantCacheService } from '../common/services/tenant-cache.service';
import { ProviderService } from '../routing/routing-core/provider.service';
import { PLAYGROUND_AGENT_NAME } from '../common/constants/playground.constants';

/**
 * Resolves the tenant's reserved `is_system` "Playground" agent — the single
 * agent every Playground run records under (so runs show as `Playground` in
 * global Messages) and which holds grants to the whole global provider pool.
 *
 * The migration seeds it for existing tenants and onboarding creates it for new
 * ones; this lazily creates it on first use as a safety net so the Playground
 * always has an agent to run under.
 */
@Injectable()
export class PlaygroundAgentService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly tenantCache: TenantCacheService,
    private readonly providerService: ProviderService,
  ) {}

  async resolve(userId: string): Promise<Agent> {
    const tenantId = await this.tenantCache.resolve(userId);
    if (!tenantId) throw new NotFoundException('Tenant not found');

    const existing = await this.findSystemAgent(tenantId);
    if (existing) return existing;

    const agent = Object.assign(new Agent(), {
      id: randomUUID(),
      name: PLAYGROUND_AGENT_NAME,
      display_name: PLAYGROUND_AGENT_NAME,
      is_system: true,
      is_active: true,
      tenant_id: tenantId,
    });
    try {
      await this.agentRepo.insert(agent);
    } catch {
      // Lost a creation race with a concurrent request — reuse the winner's row.
      const raced = await this.findSystemAgent(tenantId);
      if (raced) return raced;
      throw new NotFoundException('Playground agent could not be resolved');
    }

    // Grant the new agent the tenant's whole provider pool (global pool).
    await this.providerService.enableAllProvidersForAgent(agent.id, userId);
    return agent;
  }

  private findSystemAgent(tenantId: string): Promise<Agent | null> {
    return this.agentRepo.findOne({
      where: { tenant_id: tenantId, is_system: true, deleted_at: IsNull() },
    });
  }
}
