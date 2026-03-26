import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import {
  AgentNameParamDto,
  AgentProviderParamDto,
  ConnectProviderDto,
  RemoveProviderQueryDto,
} from './dto/routing.dto';

@Controller('api/v1/routing')
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/status')
  async getStatus(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const providers = await this.providerService.getProviders(agent.id);
    const enabled = providers.some((p) => p.is_active);
    return { enabled };
  }

  @Get(':agentName/providers')
  async getProviders(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const providers = await this.providerService.getProviders(agent.id);
    return providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      auth_type: p.auth_type ?? 'api_key',
      is_active: p.is_active,
      has_api_key: !!p.api_key_encrypted,
      key_prefix: p.key_prefix ?? null,
      connected_at: p.connected_at,
    }));
  }

  @Post(':agentName/providers')
  async upsertProvider(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: ConnectProviderDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);

    // Sync Ollama models before connecting so tier assignment has data
    if (body.provider.toLowerCase() === 'ollama') {
      await this.ollamaSync.sync();
    }

    const { provider: result } = await this.providerService.upsertProvider(
      agent.id,
      user.id,
      body.provider,
      body.apiKey,
      body.authType,
    );

    // Discover models and recalculate tiers before returning so the
    // frontend sees updated data immediately (typically ~1-3s).
    try {
      await this.discoveryService.discoverModels(result);
      await this.providerService.recalculateTiers(agent.id);
    } catch {
      // Discovery failure is non-fatal — user can retry via "Refresh models"
    }

    return {
      id: result.id,
      provider: result.provider,
      auth_type: result.auth_type ?? 'api_key',
      is_active: result.is_active,
    };
  }

  @Post(':agentName/providers/deactivate-all')
  async deactivateAllProviders(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.providerService.deactivateAllProviders(agent.id);
    return { ok: true };
  }

  @Delete(':agentName/providers/:provider')
  async removeProvider(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentProviderParamDto,
    @Query() query: RemoveProviderQueryDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const { notifications } = await this.providerService.removeProvider(
      agent.id,
      params.provider,
      query.authType,
    );
    return { ok: true, notifications };
  }
}
