import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Agent } from '../entities/agent.entity';
import { TenantCacheService } from '../common/services/tenant-cache.service';
import { TenantContext } from '../common/decorators/tenant-context.decorator';
import { PLAYGROUND_AGENT_NAME } from '../common/constants/playground.constants';

/**
 * Resolves the tenant's reserved `is_playground` "Playground" agent — the single
 * agent every Playground run records under (so runs show as `Playground` in
 * global Messages) and which has the whole global provider pool enabled.
 *
 * The migration seeds it for existing tenants and onboarding creates it for new
 * ones; this lazily creates it on first use as a safety net so the Playground
 * always has an agent to run under.
 *
 * The agent insert and provider-pool enablement are executed inside a single DB
 * transaction so a committed reserved agent always has the full pool enabled.  If a
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

  async resolve(ctx: TenantContext): Promise<Agent> {
    // The Playground is a global page that may be opened before the user has
    // created any normal agent — i.e. before onboarding created their tenant
    // row. Bootstrap the tenant so the reserved agent can always be created.
    let tenantId = ctx.tenantId;
    if (!tenantId) {
      if (!ctx.userId) throw new NotFoundException('Tenant not found');
      tenantId = await this.tenantCache.ensureForUser(ctx.userId);
    }

    const existing = await this.findPlaygroundAgent(tenantId);
    if (existing) return existing;

    const agent = Object.assign(new Agent(), {
      id: randomUUID(),
      name: PLAYGROUND_AGENT_NAME,
      display_name: PLAYGROUND_AGENT_NAME,
      is_playground: true,
      is_active: true,
      tenant_id: tenantId,
    });

    try {
      await this.dataSource.transaction(async (manager) => {
        // Insert the reserved agent row.
        await manager.getRepository(Agent).insert(agent);

        // Enable the tenant's whole provider pool for the new agent atomically — the
        // same shape the seed migration uses.  No tier recalculation needed here;
        // symmetric auto-connect handles providers added later.
        await manager.query(
          `INSERT INTO "agent_enabled_providers" ("agent_id","tenant_provider_id") ` +
            `SELECT $1, "id" FROM "tenant_providers" WHERE "tenant_id" = $2 ON CONFLICT DO NOTHING`,
          [agent.id, tenantId],
        );
      });
    } catch (err) {
      // A concurrent request may have won the unique-index race — reuse its row.
      // Any other failure is a real error (not a race): re-throw it rather than
      // masking it as a generic not-found.
      const raced = await this.findPlaygroundAgent(tenantId);
      if (raced) return raced;
      throw err;
    }

    return agent;
  }

  private findPlaygroundAgent(tenantId: string): Promise<Agent | null> {
    return this.agentRepo.findOne({
      where: { tenant_id: tenantId, is_playground: true, deleted_at: IsNull() },
    });
  }
}
