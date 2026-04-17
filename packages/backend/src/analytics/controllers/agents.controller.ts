import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CACHE_MANAGER, CacheTTL } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AgentLifecycleService } from '../services/agent-lifecycle.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CreateAgentDto } from '../../common/dto/create-agent.dto';
import { RenameAgentDto } from '../../common/dto/rename-agent.dto';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { AGENT_LIST_CACHE_TTL_MS } from '../../common/constants/cache.constants';
import { slugify } from '../../common/utils/slugify';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

@Controller('api/v1')
export class AgentsController {
  constructor(
    private readonly timeseries: TimeseriesQueriesService,
    private readonly lifecycle: AgentLifecycleService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly tenantCache: TenantCacheService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private agentListCacheKey(userId: string): string {
    return `${userId}:/api/v1/agents`;
  }

  @Get('agents')
  @UseInterceptors(UserCacheInterceptor)
  @CacheTTL(AGENT_LIST_CACHE_TTL_MS)
  async getAgents(@CurrentUser() user: AuthUser) {
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;
    const agents = await this.timeseries.getAgentList(user.id, tenantId);
    return { agents };
  }

  @Post('agents')
  async createAgent(@CurrentUser() user: AuthUser, @Body() body: CreateAgentDto) {
    const slug = slugify(body.name);
    if (!slug) {
      throw new BadRequestException('Agent name produces an empty slug');
    }
    const displayName = body.name.trim();
    let result: { tenantId: string; agentId: string; apiKey: string };
    try {
      result = await this.apiKeyGenerator.onboardAgent({
        tenantName: user.id,
        agentName: slug,
        displayName,
        email: user.email,
        agentCategory: body.agent_category,
        agentPlatform: body.agent_platform,
      });
    } catch (error) {
      if (error instanceof QueryFailedError && /unique|duplicate/i.test(error.message)) {
        throw new ConflictException(`Agent "${slug}" already exists`);
      }
      throw error;
    }
    await this.cacheManager.del(this.agentListCacheKey(user.id));
    return {
      agent: {
        id: result.agentId,
        name: slug,
        display_name: displayName,
        agent_category: body.agent_category ?? null,
        agent_platform: body.agent_platform ?? null,
      },
      apiKey: result.apiKey,
    };
  }

  @Get('agents/:agentName/key')
  async getAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const keyData = await this.apiKeyGenerator.getKeyForAgent(user.id, agentName);
    const apiKey = keyData.fullKey ?? undefined;
    return {
      keyPrefix: keyData.keyPrefix,
      ...(apiKey ? { apiKey } : {}),
    };
  }

  @Post('agents/:agentName/rotate-key')
  async rotateAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const result = await this.apiKeyGenerator.rotateKey(user.id, agentName);
    return { apiKey: result.apiKey };
  }

  @Patch('agents/:agentName')
  async updateAgent(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Body() body: RenameAgentDto,
  ) {
    const result: Record<string, unknown> = {};

    if (body.name) {
      const slug = slugify(body.name);
      if (!slug) throw new BadRequestException('Agent name produces an empty slug');
      const displayName = body.name.trim();
      await this.lifecycle.renameAgent(user.id, agentName, slug, displayName);
      result['renamed'] = true;
      result['name'] = slug;
      result['display_name'] = displayName;
    }

    if (body.agent_category !== undefined || body.agent_platform !== undefined) {
      await this.lifecycle.updateAgentType(user.id, body.name ? slugify(body.name)! : agentName, {
        agent_category: body.agent_category,
        agent_platform: body.agent_platform,
      });
      if (body.agent_category !== undefined) result['agent_category'] = body.agent_category;
      if (body.agent_platform !== undefined) result['agent_platform'] = body.agent_platform;
    }

    await this.cacheManager.del(this.agentListCacheKey(user.id));
    return result;
  }

  @Delete('agents/:agentName')
  async deleteAgent(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    await this.lifecycle.deleteAgent(user.id, agentName);
    await this.cacheManager.del(this.agentListCacheKey(user.id));
    return { deleted: true };
  }
}
