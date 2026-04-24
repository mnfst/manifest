import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { TIER_SLOTS } from 'manifest-shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { TierService } from './routing-core/tier.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import {
  AgentNameParamDto,
  SetOverrideDto,
  SetFallbacksDto,
  ToggleComplexityDto,
} from './dto/routing.dto';

@Controller('api/v1/routing')
export class TierController {
  constructor(
    private readonly tierService: TierService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/tiers')
  async getTiers(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.tierService.getTiers(agent.id, user.id);
  }

  @Get(':agentName/complexity')
  async getComplexity(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const enabled = await this.tierService.isComplexityEnabled(agent.id);
    return { enabled };
  }

  @Post(':agentName/complexity/toggle')
  async toggleComplexity(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: ToggleComplexityDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.tierService.setComplexityEnabled(agent.id, body.enabled);
    return { ok: true, enabled: body.enabled };
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
    return this.tierService.setOverride(
      agent.id,
      user.id,
      tier,
      body.model,
      body.provider,
      body.authType,
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
    return this.tierService.setFallbacks(agent.id, tier, body.models);
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

  private validateTier(tier: string): void {
    if (!(TIER_SLOTS as readonly string[]).includes(tier)) {
      throw new BadRequestException(
        `Invalid tier: ${tier}. Must be one of: ${TIER_SLOTS.join(', ')}`,
      );
    }
  }
}
