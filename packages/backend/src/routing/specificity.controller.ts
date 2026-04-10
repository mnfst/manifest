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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { SpecificityService } from './routing-core/specificity.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { AgentNameParamDto } from './dto/routing.dto';
import { SetSpecificityOverrideDto, ToggleSpecificityDto } from './dto/specificity.dto';
import { SPECIFICITY_CATEGORIES } from 'manifest-shared';

@Controller('api/v1/routing')
export class SpecificityController {
  constructor(
    private readonly specificityService: SpecificityService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/specificity')
  async getAssignments(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.specificityService.getAssignments(agent.id);
  }

  @Put(':agentName/specificity/:category')
  async setOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: SetSpecificityOverrideDto,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.specificityService.setOverride(
      agent.id,
      user.id,
      category,
      body.model,
      body.provider,
      body.authType,
    );
  }

  @Post(':agentName/specificity/:category/toggle')
  async toggleCategory(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: ToggleSpecificityDto,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.specificityService.toggleCategory(agent.id, user.id, category, body.active);
  }

  @Delete(':agentName/specificity/:category')
  async clearOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.specificityService.clearOverride(agent.id, category);
    return { ok: true };
  }

  @Put(':agentName/specificity/:category/fallbacks')
  async setFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
    @Body() body: { models: string[] },
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.specificityService.setFallbacks(agent.id, category, body.models);
  }

  @Delete(':agentName/specificity/:category/fallbacks')
  async clearFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('category') category: string,
  ) {
    this.validateCategory(category);
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.specificityService.clearFallbacks(agent.id, category);
    return { ok: true };
  }

  @Post(':agentName/specificity/reset-all')
  async resetAll(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
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
