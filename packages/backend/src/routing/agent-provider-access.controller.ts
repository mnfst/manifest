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
import { ProviderService } from './routing-core/provider.service';
import type { ModelRoute } from 'manifest-shared';

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
    private readonly providerService: ProviderService,
  ) {}

  private async resolveAgent(agentName: string, userId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { name: userId } });
    if (!tenant) return null;
    // Exclude the reserved system (Playground) agent — its grants are the global
    // pool and must not be togglable/removable through this per-agent endpoint.
    return this.agentRepo.findOne({
      where: { name: decodeURIComponent(agentName), tenant_id: tenant.id, is_system: false },
    });
  }

  @Get()
  async listEnabled(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) return { enabled: [] };

    const rows = await this.accessRepo.find({ where: { agent_id: agent.id } });
    return { enabled: rows.map((r) => r.user_provider_id) };
  }

  @Get(':userProviderId/impact')
  async getDisableImpact(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('userProviderId') userProviderId: string,
  ) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);

    const provider = await this.userProviderRepo.findOne({
      where: { id: userProviderId, user_id: user.id },
    });
    if (!provider) return { affected_tiers: [] };

    const providerModels = new Set(
      (Array.isArray(provider.cached_models) ? provider.cached_models : []).map((m) => m.id),
    );
    const providerName = provider.provider.toLowerCase();
    const providerAuthType = provider.auth_type;
    const providerLabel = provider.label?.toLowerCase();
    const routeBelongsToDisabledProvider = (route: ModelRoute | null): boolean => {
      if (!route) return false;
      if (route.provider) {
        if (route.provider.toLowerCase() !== providerName) return false;
        if (route.authType && route.authType !== providerAuthType) return false;
        if (route.keyLabel && providerLabel && route.keyLabel.toLowerCase() !== providerLabel) {
          return false;
        }
        return true;
      }
      return providerModels.has(route.model);
    };

    const tiers = await this.tierRepo.find({ where: { agent_id: agent.id } });
    const affected: Array<{ tier: string; model: string; position: string }> = [];

    for (const tier of tiers) {
      if (routeBelongsToDisabledProvider(tier.override_route)) {
        affected.push({ tier: tier.tier, model: tier.override_route!.model, position: 'primary' });
      }
      if (routeBelongsToDisabledProvider(tier.auto_assigned_route)) {
        affected.push({
          tier: tier.tier,
          model: tier.auto_assigned_route!.model,
          position: 'auto-assigned',
        });
      }
      for (const [i, fb] of (tier.fallback_routes ?? []).entries()) {
        if (routeBelongsToDisabledProvider(fb)) {
          affected.push({ tier: tier.tier, model: fb.model, position: `fallback ${i + 1}` });
        }
      }
    }

    return { affected_tiers: affected };
  }

  @Put(':userProviderId')
  async enable(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('userProviderId') userProviderId: string,
  ) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);

    const provider = await this.userProviderRepo.findOne({
      where: { id: userProviderId, user_id: user.id },
    });
    if (!provider) throw new HttpException('Provider not found', HttpStatus.NOT_FOUND);

    await this.accessRepo
      .createQueryBuilder()
      .insert()
      .into(AgentProviderAccess)
      .values({ agent_id: agent.id, user_provider_id: userProviderId })
      .orIgnore()
      .execute();
    await this.providerService.recalculateTiers(agent.id, user.id);

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

    const provider = await this.userProviderRepo.findOne({
      where: { id: userProviderId, user_id: user.id },
    });
    if (provider) {
      const providerModels = new Set(
        (Array.isArray(provider.cached_models) ? provider.cached_models : []).map((m) => m.id),
      );
      const providerName = provider.provider.toLowerCase();
      const providerAuthType = provider.auth_type;
      const providerLabel = provider.label?.toLowerCase();
      const routeBelongsToDisabledProvider = (route: ModelRoute | null): boolean => {
        if (!route) return false;
        if (route.provider) {
          if (route.provider.toLowerCase() !== providerName) return false;
          if (route.authType && route.authType !== providerAuthType) return false;
          if (route.keyLabel && providerLabel && route.keyLabel.toLowerCase() !== providerLabel) {
            return false;
          }
          return true;
        }
        return providerModels.has(route.model);
      };

      const tiers = await this.tierRepo.find({ where: { agent_id: agent.id } });
      for (const tier of tiers) {
        let changed = false;
        if (routeBelongsToDisabledProvider(tier.override_route)) {
          tier.override_route = null;
          changed = true;
        }
        if (routeBelongsToDisabledProvider(tier.auto_assigned_route)) {
          tier.auto_assigned_route = null;
          changed = true;
        }
        const fallbacks = tier.fallback_routes ?? [];
        const filtered = fallbacks.filter((fb) => !routeBelongsToDisabledProvider(fb));
        if (filtered.length !== fallbacks.length) {
          tier.fallback_routes = filtered.length > 0 ? filtered : null;
          changed = true;
        }
        if (changed) await this.tierRepo.save(tier);
      }
    }

    await this.accessRepo.delete({ agent_id: agent.id, user_provider_id: userProviderId });
    await this.providerService.recalculateTiers(agent.id, user.id);
    return { ok: true };
  }
}
