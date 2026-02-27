import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AggregationService } from '../services/aggregation.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CreateAgentDto } from '../../common/dto/create-agent.dto';
import { RenameAgentDto } from '../../common/dto/rename-agent.dto';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';
import { readLocalApiKey } from '../../common/constants/local-mode.constants';
import { trackCloudEvent } from '../../common/utils/product-telemetry';
import { slugify } from '../../common/utils/slugify';

@Controller('api/v1')
export class AgentsController {
  constructor(
    private readonly timeseries: TimeseriesQueriesService,
    private readonly aggregation: AggregationService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly config: ConfigService,
  ) {}

  @Get('agents')
  @UseInterceptors(UserCacheInterceptor)
  @CacheTTL(DASHBOARD_CACHE_TTL_MS)
  async getAgents(@CurrentUser() user: AuthUser) {
    const agents = await this.timeseries.getAgentList(user.id);
    return { agents };
  }

  @Post('agents')
  async createAgent(@CurrentUser() user: AuthUser, @Body() body: CreateAgentDto) {
    const slug = slugify(body.name);
    if (!slug) {
      throw new BadRequestException('Agent name produces an empty slug');
    }
    const displayName = body.name.trim();
    const result = await this.apiKeyGenerator.onboardAgent({
      tenantName: user.id,
      agentName: slug,
      displayName,
      email: user.email,
    });
    trackCloudEvent('agent_created', user.id, { agent_name: slug });
    return { agent: { id: result.agentId, name: slug, display_name: displayName }, apiKey: result.apiKey };
  }

  @Get('agents/:agentName/key')
  async getAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const keyData = await this.apiKeyGenerator.getKeyForAgent(user.id, agentName);
    const customEndpoint = this.config.get<string>('app.pluginOtlpEndpoint', '');
    const isLocal = this.config.get<string>('MANIFEST_MODE') === 'local';
    const fullKey = isLocal ? readLocalApiKey() : undefined;
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
    return { renamed: true, name: slug, display_name: displayName };
  }

  @Delete('agents/:agentName')
  async deleteAgent(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    if (this.config.get<string>('MANIFEST_MODE') === 'local') {
      throw new ForbiddenException('Cannot delete agents in local mode');
    }
    await this.aggregation.deleteAgent(user.id, agentName);
    return { deleted: true };
  }
}
