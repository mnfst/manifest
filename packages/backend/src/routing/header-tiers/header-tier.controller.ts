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
import { IsArray, IsString } from 'class-validator';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { HeaderTierService } from './header-tier.service';
import type { TierColor } from 'manifest-shared';

interface CreateHeaderTierBody {
  name: string;
  header_key: string;
  header_value: string;
  badge_color: TierColor;
}

interface UpdateHeaderTierBody {
  name?: string;
  header_key?: string;
  header_value?: string;
  badge_color?: TierColor;
}

interface ReorderBody {
  ids: string[];
}

interface OverrideBody {
  model: string;
  provider?: string;
  authType?: 'api_key' | 'subscription';
}

class FallbacksBody {
  @IsArray()
  @IsString({ each: true })
  models!: string[];
}

@Controller('api/v1/routing')
export class HeaderTierController {
  constructor(
    private readonly headerTierService: HeaderTierService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly tenantCache: TenantCacheService,
  ) {}

  @Get(':agentName/header-tiers')
  async list(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.headerTierService.list(agent.id);
  }

  @Post(':agentName/header-tiers')
  async create(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Body() body: CreateHeaderTierBody,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? null;
    return this.headerTierService.create(agent.id, user.id, tenantId, body);
  }

  @Put(':agentName/header-tiers/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: UpdateHeaderTierBody,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.headerTierService.update(agent.id, id, body);
  }

  @Patch(':agentName/header-tiers/:id/toggle')
  async toggle(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.headerTierService.setEnabled(agent.id, id, body.enabled);
  }

  @Delete(':agentName/header-tiers/:id')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.headerTierService.delete(agent.id, id);
    return { ok: true };
  }

  @Post(':agentName/header-tiers/reorder')
  async reorder(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Body() body: ReorderBody,
  ) {
    if (!body || !Array.isArray(body.ids)) {
      throw new BadRequestException('reorder: body.ids must be an array');
    }
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.headerTierService.reorder(agent.id, body.ids);
    return { ok: true };
  }

  @Put(':agentName/header-tiers/:id/override')
  async setOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: OverrideBody,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.headerTierService.setOverride(
      agent.id,
      id,
      body.model,
      body.provider,
      body.authType,
    );
  }

  @Delete(':agentName/header-tiers/:id/override')
  async clearOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.headerTierService.clearOverride(agent.id, id);
    return { ok: true };
  }

  @Put(':agentName/header-tiers/:id/fallbacks')
  async setFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: FallbacksBody,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.headerTierService.setFallbacks(agent.id, id, body.models);
  }

  @Delete(':agentName/header-tiers/:id/fallbacks')
  async clearFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.headerTierService.clearFallbacks(agent.id, id);
    return { ok: true };
  }
}
