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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TIER_SLOTS } from 'manifest-shared';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { TierService } from './routing-core/tier.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import {
  AgentNameParamDto,
  SetOverrideDto,
  SetFallbacksDto,
  SetResponseModeDto,
  responseModeFromDto,
  UpdateAutofixDto,
} from './dto/routing.dto';
import { Agent } from '../entities/agent.entity';
import { AutofixService } from './autofix/autofix.service';

@Controller('api/v1/routing')
export class TierController {
  constructor(
    private readonly tierService: TierService,
    private readonly resolveAgentService: ResolveAgentService,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly autofixService: AutofixService,
  ) {}

  @Get(':agentName/tiers')
  async getTiers(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    return this.tierService.getTiers(agent.id, agent.tenant_id);
  }

  @Put(':agentName/tiers/:tier')
  async setOverride(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetOverrideDto,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    // Prefer the structured route when the client sent it, otherwise use the
    // flat fields. Either form is accepted — the service synthesizes the
    // missing one before persisting. `route.keyLabel` and the legacy flat
    // `providerKeyLabel` carry the same multi-key pin.
    const model = body.route?.model ?? body.model;
    const provider = body.route?.provider ?? body.provider;
    const authType = body.route?.authType ?? body.authType;
    const providerKeyLabel = body.route?.keyLabel ?? body.providerKeyLabel;
    return this.tierService.setOverride(
      agent.id,
      agent.tenant_id,
      tier,
      model,
      provider,
      authType,
      providerKeyLabel,
    );
  }

  @Delete(':agentName/tiers/:tier')
  async clearOverride(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    await this.tierService.clearOverride(agent.id, tier);
    return { ok: true };
  }

  @Patch(':agentName/tiers/:tier/response-mode')
  async setResponseMode(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetResponseModeDto,
  ) {
    this.validateTier(tier);
    const responseMode = responseModeFromDto(body);
    if (!responseMode) throw new BadRequestException('response_mode is required');
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.tierService.setResponseMode(agent.id, tier, responseMode);
  }

  @Post(':agentName/tiers/reset-all')
  async resetAllOverrides(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    await this.tierService.resetAllOverrides(agent.id);
    return { ok: true };
  }

  @Get(':agentName/tiers/:tier/fallbacks')
  async getFallbacks(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.tierService.getFallbacks(agent.id, tier);
  }

  @Put(':agentName/tiers/:tier/fallbacks')
  async setFallbacks(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetFallbacksDto,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return this.tierService.setFallbacks(agent.id, agent.tenant_id, tier, body.models, body.routes);
  }

  @Delete(':agentName/tiers/:tier/fallbacks')
  async clearFallbacks(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    await this.tierService.clearFallbacks(agent.id, tier);
    return { ok: true };
  }

  @Get(':agentName/complexity/status')
  async getComplexityStatus(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    return { enabled: agent.complexity_routing_enabled };
  }

  @Post(':agentName/complexity/toggle')
  async toggleComplexity(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const newValue = !agent.complexity_routing_enabled;
    await this.agentRepo.update(agent.id, { complexity_routing_enabled: newValue });
    this.resolveAgentService.invalidate(agent.tenant_id, agentName);
    return { enabled: newValue };
  }

  @Get(':agentName/autofix')
  async getAutofix(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const available = await this.autofixService.hasAccess(ctx.tenantId);
    // `available` gates the toggle's visibility in the UI (early-access rollout);
    // `enabled` reports effective runtime behavior, so a tenant outside the
    // cohort never appears enabled merely because its mode default is on.
    return {
      enabled: available && this.autofixService.resolveEnabled(agent.autofix_enabled),
      available,
    };
  }

  @Patch(':agentName/autofix')
  async updateAutofix(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Body() body: UpdateAutofixDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const available = await this.autofixService.hasAccess(ctx.tenantId);
    // Only tenants with early access can change the flag; others have no toggle.
    // Require an explicit boolean: `@IsOptional()` lets `{"enabled": null}` through,
    // and a bare presence check would then reset the stored flag to null and echo
    // back `enabled: null` (off-contract). Undefined/null → no write, read-back.
    const applied = available && typeof body.enabled === 'boolean';
    if (applied) {
      await this.agentRepo.update(agent.id, { autofix_enabled: body.enabled });
      this.resolveAgentService.invalidate(agent.tenant_id, agentName);
      this.autofixService.invalidateConfig(agent.tenant_id, agent.id);
    }
    return {
      enabled: applied
        ? (body.enabled as boolean)
        : available && this.autofixService.resolveEnabled(agent.autofix_enabled),
      available,
    };
  }

  private validateTier(tier: string): void {
    if (!(TIER_SLOTS as readonly string[]).includes(tier)) {
      throw new BadRequestException(
        `Invalid tier: ${tier}. Must be one of: ${TIER_SLOTS.join(', ')}`,
      );
    }
  }
}
