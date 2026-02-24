import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AggregationService } from '../services/aggregation.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CreateAgentDto } from '../../common/dto/create-agent.dto';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';

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
    const result = await this.apiKeyGenerator.onboardAgent({
      tenantName: user.id,
      agentName: body.name,
      email: user.email,
    });
    return { agent: { id: result.agentId, name: body.name }, apiKey: result.apiKey };
  }

  @Get('agents/:agentName/key')
  async getAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const keyData = await this.apiKeyGenerator.getKeyForAgent(user.id, agentName);
    const customEndpoint = this.config.get<string>('app.pluginOtlpEndpoint', '');
    return {
      ...keyData,
      ...(customEndpoint ? { pluginEndpoint: customEndpoint } : {}),
    };
  }

  @Post('agents/:agentName/rotate-key')
  async rotateAgentKey(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    const result = await this.apiKeyGenerator.rotateKey(user.id, agentName);
    return { apiKey: result.apiKey };
  }

  @Delete('agents/:agentName')
  async deleteAgent(@CurrentUser() user: AuthUser, @Param('agentName') agentName: string) {
    if (process.env['MANIFEST_MODE'] === 'local') {
      throw new ForbiddenException('Cannot delete agents in local mode');
    }
    await this.aggregation.deleteAgent(user.id, agentName);
    return { deleted: true };
  }
}
