import { Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';

@Controller('api/v1/agents/:agentName/provider-access')
export class AgentProviderAccessController {
  constructor(
    @InjectRepository(AgentProviderAccess)
    private readonly accessRepo: Repository<AgentProviderAccess>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
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
    if (!agent) return { enabled: [] };

    const rows = await this.accessRepo.find({ where: { agent_id: agent.id } });
    return { enabled: rows.map((r) => r.user_provider_id) };
  }

  @Put(':userProviderId')
  async enable(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('userProviderId') userProviderId: string,
  ) {
    const agent = await this.resolveAgent(agentName, user.id);
    if (!agent) return { ok: false };

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
    if (!agent) return { ok: false };

    await this.accessRepo.delete({ agent_id: agent.id, user_provider_id: userProviderId });
    return { ok: true };
  }
}
