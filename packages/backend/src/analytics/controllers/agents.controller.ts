import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
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
import { ConfigService } from '@nestjs/config';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AggregationService } from '../services/aggregation.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CreateAgentDto } from '../../common/dto/create-agent.dto';
import { RenameAgentDto } from '../../common/dto/rename-agent.dto';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { AGENT_LIST_CACHE_TTL_MS } from '../../common/constants/cache.constants';
import { readLocalApiKey, LOCAL_AGENT_NAME } from '../../common/constants/local-mode.constants';
import { slugify } from '../../common/utils/slugify';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

@Controller('api/v1')
export class AgentsController {
  constructor(
    private readonly timeseries: TimeseriesQueriesService,
    private readonly aggregation: AggregationService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly config: ConfigService,
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
      });
    } catch (error) {
      if (error instanceof QueryFailedError && /unique|duplicate/i.test(error.message)) {
        throw new ConflictException(`Agent "${slug}" already exists`);
      }
      throw error;
    }
    await this.cacheManager.del(this.agentListCacheKey(user.id));
    return {
      agent: { id: result.agentId, name: slug, display_name: displayName },
      apiKey: result.apiKey,
    };
  }

  @Get('agents/:agentName/key')
  async getAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const keyData = await this.apiKeyGenerator.getKeyForAgent(user.id, agentName);
    const customEndpoint = this.config.get<string>('app.pluginOtlpEndpoint', '');
    const isLocal = this.config.get<string>('MANIFEST_MODE') === 'local';
    const fullKey = isLocal && agentName === LOCAL_AGENT_NAME ? readLocalApiKey() : undefined;
    return {
      ...keyData,
      ...(fullKey ? { apiKey: fullKey } : {}),
      ...(customEndpoint ? { pluginEndpoint: customEndpoint } : {}),
    };
  }

  @Post('agents/:agentName/rotate-key')
  async rotateAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const result = await this.apiKeyGenerator.rotateKey(user.id, agentName);
    return { apiKey: result.apiKey };
  }

  @Patch('agents/:agentName')
  async renameAgent(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Body() body: RenameAgentDto,
  ) {
    const slug = slugify(body.name);
    if (!slug) {
      throw new BadRequestException('Agent name produces an empty slug');
    }
    const displayName = body.name.trim();
    await this.aggregation.renameAgent(user.id, agentName, slug, displayName);
    await this.cacheManager.del(this.agentListCacheKey(user.id));
    return { renamed: true, name: slug, display_name: displayName };
  }

  @Delete('agents/:agentName')
  async deleteAgent(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    if (this.config.get<string>('MANIFEST_MODE') === 'local' && agentName === LOCAL_AGENT_NAME) {
      throw new ForbiddenException('Cannot delete the default local agent');
    }
    await this.aggregation.deleteAgent(user.id, agentName);
    await this.cacheManager.del(this.agentListCacheKey(user.id));
    return { deleted: true };
  }
}
