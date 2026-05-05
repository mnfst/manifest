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
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { ModelRouteDto } from '../dto/routing.dto';
import { HeaderTierService } from './header-tier.service';
import { AUTH_TYPES, type TierColor } from 'manifest-shared';

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

class OverrideBody {
  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  provider?: string;

  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: 'api_key' | 'subscription' | 'local';

  // Validate the nested route shape so a malformed payload can't bypass the
  // legacy field validators above by being smuggled in through `route`.
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelRouteDto)
  route?: ModelRouteDto;
}

class FallbacksBody {
  @IsArray()
  @IsString({ each: true })
  models!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ModelRouteDto)
  routes?: ModelRouteDto[];
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
    const model = body.route?.model ?? body.model;
    const provider = body.route?.provider ?? body.provider;
    const authType = body.route?.authType ?? body.authType;
    return this.headerTierService.setOverride(agent.id, id, model, provider, authType);
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
    return this.headerTierService.setFallbacks(agent.id, id, body.models, body.routes);
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
