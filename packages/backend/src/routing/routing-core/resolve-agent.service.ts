import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

const TTL_MS = 120_000; // 2 minutes
const MAX_ENTRIES = 5_000;

interface CachedAgent {
  agent: Agent;
  expiresAt: number;
}

@Injectable()
export class ResolveAgentService {
  private readonly cache = new Map<string, CachedAgent>();

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async resolve(userId: string, agentName: string): Promise<Agent> {
    const tenantId = await this.tenantCache.resolve(userId);
    if (!tenantId) throw new NotFoundException('Tenant not found');

    const cacheKey = `${tenantId}:${agentName}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.agent;
    if (cached) this.cache.delete(cacheKey);

    const agent = await this.agentRepo.findOne({
      where: { tenant_id: tenantId, name: agentName, deleted_at: IsNull() },
    });
    if (!agent) throw new NotFoundException(`Agent "${agentName}" not found`);

    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(cacheKey)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, { agent, expiresAt: Date.now() + TTL_MS });
    return agent;
  }

  invalidate(tenantId: string, agentName: string): void {
    this.cache.delete(`${tenantId}:${agentName}`);
  }
}
