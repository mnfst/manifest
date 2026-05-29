import { Controller, Delete, Get, HttpException, HttpStatus, Param, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';

@Controller('api/v1/agents/:agentName/provider-access')
export class AgentProviderAccessController {
  constructor(
    @InjectRepository(AgentProviderAccess)
    private readonly accessRepo: Repository<AgentProviderAccess>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(UserProvider)
    private readonly userProviderRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
  ) {}

  private async resolveAgent(agentName: string, userId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { name: userId } });
    if (!tenant) return null;
    return this.agentRepo.findOne({
      where: { name: decodeURIComponent(agentName), tenant_id: tenant.id },
    });
  }

  @Get()
  async listEnabled(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) return { enabled: [], explicit: false };

    const rows = await this.accessRepo.find({ where: { agent_id: agent.id } });
    return {
      enabled: rows.map((r) => r.user_provider_id),
      explicit: rows.length > 0,
    };
  }

  @Put(':userProviderId')
  async enable(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('userProviderId') userProviderId: string,
  ) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);

    await this.accessRepo
      .createQueryBuilder()
      .insert()
      .into(AgentProviderAccess)
      .values({ agent_id: agent.id, user_provider_id: userProviderId })
      .orIgnore()
      .execute();

    return { ok: true };
  }

  @Delete(':userProviderId')
  async disable(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('userProviderId') userProviderId: string,
  ) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);

    // Check if the provider has models actively used in routing
    const provider = await this.userProviderRepo.findOne({
      where: { id: userProviderId, user_id: user.id },
    });
    if (provider) {
      const providerModels = new Set(
        (Array.isArray(provider.cached_models) ? provider.cached_models : []).map((m) => m.id),
      );

      if (providerModels.size > 0) {
        const tiers = await this.tierRepo.find({ where: { agent_id: agent.id } });
        const provName = provider.provider;
        for (const tier of tiers) {
          const route = tier.override_route ?? tier.auto_assigned_route;
          if (route && providerModels.has(route.model)) {
            throw new HttpException(
              `Cannot disable ${provName}: model "${route.model}" is assigned in routing. Remove it first.`,
              HttpStatus.CONFLICT,
            );
          }
          for (const fb of tier.fallback_routes ?? []) {
            if (providerModels.has(fb.model)) {
              throw new HttpException(
                `Cannot disable ${provName}: model "${fb.model}" is assigned in routing. Remove it first.`,
                HttpStatus.CONFLICT,
              );
            }
          }
        }
      }
    }

    // If no explicit entries exist yet, populate with all user providers first
    const existing = await this.accessRepo.count({ where: { agent_id: agent.id } });
    if (existing === 0) {
      const allProviders = await this.userProviderRepo.find({
        where: { user_id: user.id, is_active: true },
      });
      if (allProviders.length > 0) {
        await this.accessRepo
          .createQueryBuilder()
          .insert()
          .into(AgentProviderAccess)
          .values(allProviders.map((p) => ({ agent_id: agent.id, user_provider_id: p.id })))
          .orIgnore()
          .execute();
      }
    }

    // Remove the one being disabled
    await this.accessRepo.delete({ agent_id: agent.id, user_provider_id: userProviderId });
    return { ok: true };
  }
}
