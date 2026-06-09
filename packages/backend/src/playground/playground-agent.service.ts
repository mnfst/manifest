import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { TenantCacheService } from '../common/services/tenant-cache.service';
import { PLAYGROUND_AGENT_NAME } from '../common/constants/playground.constants';

/**
 * Resolves the tenant's reserved `is_system` "Playground" agent — the single
 * agent every Playground run records under (so runs show as `Playground` in
 * global Messages) and which holds grants to the whole global provider pool.
 *
 * The migration seeds it for existing tenants and onboarding creates it for new
 * ones; this lazily creates it on first use as a safety net so the Playground
 * always has an agent to run under.
 *
 * The agent insert and provider-pool grant are executed inside a single DB
 * transaction so a committed reserved agent is always fully granted.  If a
 * concurrent request wins the unique-index race the transaction throws and we
 * simply return the winner's row.
 */
@Injectable()
export class PlaygroundAgentService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly tenantCache: TenantCacheService,
    private readonly dataSource: DataSource,
  ) {}

  async resolve(userId: string): Promise<Agent> {
    // The Playground is a global page that may be opened before the user has
    // created any normal agent — i.e. before onboarding created their tenant row.
    // Bootstrap the tenant so the reserved agent can always be created.
    const cached = await this.tenantCache.resolve(userId);
    let tenantId: string;
    if (cached) {
      tenantId = cached;
    } else {
      tenantId = await this.ensureTenant(userId);
      // Bust the stale null so subsequent resolves (e.g. ResolveAgentService) see
      // the real tenant id instead of waiting out the 5-minute TTL.
      this.tenantCache.invalidate(userId);
    }

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
      await this.dataSource.transaction(async (manager) => {
        // Insert the reserved agent row.
        await manager.getRepository(Agent).insert(agent);

        // Grant the new agent the tenant's whole provider pool atomically — the
        // same shape the seed migration uses.  No tier recalculation needed here;
        // symmetric auto-connect handles providers added later.
        await manager.query(
          `INSERT INTO "agent_provider_access" ("agent_id","user_provider_id") ` +
            `SELECT $1, "id" FROM "user_providers" WHERE "user_id" = $2 ON CONFLICT DO NOTHING`,
          [agent.id, userId],
        );
      });
    } catch {
      // Lost a creation race with a concurrent request — reuse the winner's row.
      const raced = await this.findSystemAgent(tenantId);
      if (raced) return raced;
      throw new NotFoundException('Playground agent could not be resolved');
    }

    return agent;
  }

  private findSystemAgent(tenantId: string): Promise<Agent | null> {
    return this.agentRepo.findOne({
      where: { tenant_id: tenantId, is_system: true, deleted_at: IsNull() },
    });
  }

  /** Create the user's tenant row if it doesn't exist yet (race-safe). */
  private async ensureTenant(userId: string): Promise<string> {
    const repo = this.dataSource.getRepository(Tenant);
    const existing = await repo.findOne({ where: { name: userId } });
    if (existing) return existing.id;

    const id = randomUUID();
    try {
      await repo.insert({ id, name: userId, is_active: true });
      return id;
    } catch {
      // Lost a creation race — reuse the winner's row.
      const raced = await repo.findOne({ where: { name: userId } });
      if (raced) return raced.id;
      throw new NotFoundException('Tenant could not be resolved');
    }
  }
}
