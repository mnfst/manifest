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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { TierService } from './routing-core/tier.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import {
  AgentNameParamDto,
  SetOverrideDto,
  SetFallbacksDto,
  SetResponseModeDto,
  responseModeFromDto,
} from './dto/routing.dto';
import { Agent } from '../entities/agent.entity';

@Controller('api/v1/routing')
export class TierController {
  constructor(
    private readonly tierService: TierService,
    private readonly resolveAgentService: ResolveAgentService,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  @Get(':agentName/tiers')
  async getTiers(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.tierService.getTiers(agent.id, user.id);
  }

  @Put(':agentName/tiers/:tier')
  async setOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetOverrideDto,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
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
      user.id,
      tier,
      model,
      provider,
      authType,
      providerKeyLabel,
    );
  }

  @Delete(':agentName/tiers/:tier')
  async clearOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.tierService.clearOverride(agent.id, tier);
    return { ok: true };
  }

  @Patch(':agentName/tiers/:tier/response-mode')
  async setResponseMode(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetResponseModeDto,
  ) {
    this.validateTier(tier);
    const responseMode = responseModeFromDto(body);
    if (!responseMode) throw new BadRequestException('response_mode is required');
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.tierService.setResponseMode(agent.id, user.id, tier, responseMode);
  }

  @Post(':agentName/tiers/reset-all')
  async resetAllOverrides(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.tierService.resetAllOverrides(agent.id);
    return { ok: true };
  }

  @Get(':agentName/tiers/:tier/fallbacks')
  async getFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.tierService.getFallbacks(agent.id, tier);
  }

  @Put(':agentName/tiers/:tier/fallbacks')
  async setFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetFallbacksDto,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.tierService.setFallbacks(agent.id, tier, body.models, body.routes);
  }

  @Delete(':agentName/tiers/:tier/fallbacks')
  async clearFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    this.validateTier(tier);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.tierService.clearFallbacks(agent.id, tier);
    return { ok: true };
  }

  @Get(':agentName/complexity/status')
  async getComplexityStatus(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return { enabled: agent.complexity_routing_enabled };
  }

  @Post(':agentName/complexity/toggle')
  async toggleComplexity(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    const newValue = !agent.complexity_routing_enabled;
    await this.agentRepo.update(agent.id, { complexity_routing_enabled: newValue });
    this.resolveAgentService.invalidate(agent.tenant_id, agentName);
    return { enabled: newValue };
  }

  private validateTier(tier: string): void {
    if (!(TIER_SLOTS as readonly string[]).includes(tier)) {
      throw new BadRequestException(
        `Invalid tier: ${tier}. Must be one of: ${TIER_SLOTS.join(', ')}`,
      );
    }
  }
}
