import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { SpecificityService } from './routing-core/specificity.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import {
  AgentNameParamDto,
  SetFallbacksDto,
  SetResponseModeDto,
  responseModeFromDto,
} from './dto/routing.dto';
import { SetSpecificityOverrideDto, ToggleSpecificityDto } from './dto/specificity.dto';
import { SPECIFICITY_CATEGORIES } from 'manifest-shared';

@Controller('api/v1/routing')
export class SpecificityController {
  constructor(
    private readonly specificityService: SpecificityService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/specificity')
  async getAssignments(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    return this.specificityService.getAssignments(agent.id);
  }

  @Put(':agentName/specificity/:category')
  async setOverride(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: SetSpecificityOverrideDto,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    // Prefer the structured route when the client sent it, otherwise use the
    // flat fields. `route.keyLabel` and the legacy flat `providerKeyLabel`
    // carry the same multi-key pin.
    const model = body.route?.model ?? body.model;
    const provider = body.route?.provider ?? body.provider;
    const authType = body.route?.authType ?? body.authType;
    const providerKeyLabel = body.route?.keyLabel ?? body.providerKeyLabel;
    return this.specificityService.setOverride(
      agent.id,
      agent.tenant_id,
      category,
      model,
      provider,
      authType,
      providerKeyLabel,
    );
  }

  @Post(':agentName/specificity/:category/toggle')
  async toggleCategory(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: ToggleSpecificityDto,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.specificityService.toggleCategory(agent.id, category, body.active);
  }

  @Delete(':agentName/specificity/:category')
  async clearOverride(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    await this.specificityService.clearOverride(agent.id, category);
    return { ok: true };
  }

  @Patch(':agentName/specificity/:category/response-mode')
  async setResponseMode(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: SetResponseModeDto,
  ) {
    this.validateCategory(category);
    const responseMode = responseModeFromDto(body);
    if (!responseMode) throw new BadRequestException('response_mode is required');
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.specificityService.setResponseMode(agent.id, category, responseMode);
  }

  @Put(':agentName/specificity/:category/fallbacks')
  async setFallbacks(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: SetFallbacksDto,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.specificityService.setFallbacks(
      agent.id,
      agent.tenant_id,
      category,
      body.models,
      body.routes,
    );
  }

  @Delete(':agentName/specificity/:category/fallbacks')
  async clearFallbacks(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    await this.specificityService.clearFallbacks(agent.id, category);
    return { ok: true };
  }

  @Post(':agentName/specificity/reset-all')
  async resetAll(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    await this.specificityService.resetAll(agent.id);
    return { ok: true };
  }

  private validateCategory(category: string): void {
    if (!(SPECIFICITY_CATEGORIES as readonly string[]).includes(category)) {
      throw new BadRequestException(
        `Invalid category: ${category}. Must be one of: ${SPECIFICITY_CATEGORIES.join(', ')}`,
      );
    }
  }
}
