import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AggregationService } from '../services/aggregation.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CreateAgentDto } from '../../common/dto/create-agent.dto';
import { RenameAgentDto } from '../../common/dto/rename-agent.dto';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';

const IS_LOCAL = process.env['MANIFEST_MODE'] === 'local';

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
    const fullKey = IS_LOCAL ? readLocalApiKey() : undefined;
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
    await this.aggregation.renameAgent(user.id, agentName, body.name);
    return { renamed: true, name: body.name };
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

function readLocalApiKey(): string | null {
  try {
    const configPath = join(homedir(), '.openclaw', 'manifest', 'config.json');
    if (!existsSync(configPath)) return null;
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    return typeof data.apiKey === 'string' ? data.apiKey : null;
  } catch {
    return null;
  }
}
