import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import {
  CreateModelAliasDto,
  SetModelAliasEnabledDto,
  UpdateModelAliasDto,
} from './model-alias.dto';
import { ModelAliasService } from './model-alias.service';

@Controller('api/v1/routing')
export class ModelAliasController {
  constructor(
    private readonly modelAliasService: ModelAliasService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/model-aliases')
  async list(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.modelAliasService.list(agent.id);
  }

  @Post(':agentName/model-aliases')
  async create(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Body() body: CreateModelAliasDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.modelAliasService.create(agent.id, agent.tenant_id, body);
  }

  @Patch(':agentName/model-aliases/:aliasId')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('aliasId') aliasId: string,
    @Body() body: UpdateModelAliasDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.modelAliasService.update(agent.id, agent.tenant_id, aliasId, body);
  }

  @Patch(':agentName/model-aliases/:aliasId/enabled')
  async setEnabled(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('aliasId') aliasId: string,
    @Body() body: SetModelAliasEnabledDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.modelAliasService.setEnabled(agent.id, aliasId, body.enabled);
  }

  @Delete(':agentName/model-aliases/:aliasId')
  async delete(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('aliasId') aliasId: string,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    await this.modelAliasService.delete(agent.id, aliasId);
    return { ok: true };
  }
}
