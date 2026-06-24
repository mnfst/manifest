import { Controller, Delete, Get, HttpException, HttpStatus, Param, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { Agent } from '../entities/agent.entity';
import { AgentHealingEnabled } from '../entities/agent-healing-enabled.entity';

/**
 * Per-agent healing activation, toggled from the dashboard. Mirrors
 * `agent-enabled-providers.controller`: presence of a row = enabled.
 */
@Controller('api/v1/agents/:agentName/healing')
export class AgentHealingController {
  constructor(
    @InjectRepository(AgentHealingEnabled)
    private readonly healingRepo: Repository<AgentHealingEnabled>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  private resolveAgent(agentName: string, tenantId: string | null) {
    if (!tenantId) return null;
    return this.agentRepo.findOne({
      where: { name: decodeURIComponent(agentName), tenant_id: tenantId, is_playground: false },
    });
  }

  @Get()
  async status(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgent(agentName, ctx.tenantId);
    if (!agent) return { enabled: false };
    const row = await this.healingRepo.findOne({ where: { agent_id: agent.id } });
    return { enabled: Boolean(row) };
  }

  @Put()
  async enable(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgent(agentName, ctx.tenantId);
    if (!agent) throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    await this.healingRepo
      .createQueryBuilder()
      .insert()
      .into(AgentHealingEnabled)
      .values({ agent_id: agent.id })
      .orIgnore()
      .execute();
    return { ok: true };
  }

  @Delete()
  async disable(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgent(agentName, ctx.tenantId);
    if (!agent) throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    await this.healingRepo.delete({ agent_id: agent.id });
    return { ok: true };
  }
}
