import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { RoutingService } from './routing.service';
import { ResolveAgentService } from './resolve-agent.service';
import { CustomProviderService } from './custom-provider.service';
import { ModelDiscoveryService } from './model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';
import {
  AgentNameParamDto,
  AgentProviderParamDto,
  ConnectProviderDto,
  CopilotPollDto,
  RemoveProviderQueryDto,
  SetOverrideDto,
  SetFallbacksDto,
} from './dto/routing.dto';

@Controller('api/v1/routing')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly customProviderService: CustomProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly copilotAuth: CopilotDeviceAuthService,
  ) {}

  /* ── Status ── */

  @Get(':agentName/status')
  async getStatus(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const providers = await this.routingService.getProviders(agent.id);
    const enabled = providers.some((p) => p.is_active);
    return { enabled };
  }

  /* ── Providers ── */

  @Get(':agentName/providers')
  async getProviders(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const providers = await this.routingService.getProviders(agent.id);
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

    const { provider: result, isNew } = await this.routingService.upsertProvider(
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
      await this.routingService.recalculateTiers(agent.id);
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
    await this.routingService.deactivateAllProviders(agent.id);
    return { ok: true };
  }

  @Delete(':agentName/providers/:provider')
  async removeProvider(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentProviderParamDto,
    @Query() query: RemoveProviderQueryDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const { notifications } = await this.routingService.removeProvider(
      agent.id,
      params.provider,
      query.authType,
    );
    return { ok: true, notifications };
  }

  /* ── Copilot device login ── */

  @Post(':agentName/copilot/device-code')
  async copilotDeviceCode(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.copilotAuth.requestDeviceCode();
  }

  @Post(':agentName/copilot/poll-token')
  async copilotPollToken(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: CopilotPollDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const result = await this.copilotAuth.pollForToken(body.deviceCode);
    if (result.status === 'complete' && result.token) {
      const { provider: record } = await this.routingService.upsertProvider(
        agent.id,
        user.id,
        'copilot',
        result.token,
        'subscription',
      );
      try {
        await this.discoveryService.discoverModels(record);
        await this.routingService.recalculateTiers(agent.id);
      } catch {
        // Discovery failure is non-fatal
      }
    }
    return { status: result.status };
  }

  /* ── Model refresh ── */

  @Post(':agentName/refresh-models')
  async refreshModels(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.discoveryService.discoverAllForAgent(agent.id);
    await this.routingService.recalculateTiers(agent.id);
    return { ok: true };
  }

  /* ── Tiers ── */

  @Get(':agentName/tiers')
  async getTiers(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.routingService.getTiers(agent.id, user.id);
  }

  @Put(':agentName/tiers/:tier')
  async setOverride(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetOverrideDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.routingService.setOverride(
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
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.routingService.clearOverride(agent.id, tier);
    return { ok: true };
  }

  /* ── Fallbacks ── */

  @Get(':agentName/tiers/:tier/fallbacks')
  async getFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.routingService.getFallbacks(agent.id, tier);
  }

  @Put(':agentName/tiers/:tier/fallbacks')
  async setFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
    @Body() body: SetFallbacksDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    return this.routingService.setFallbacks(agent.id, tier, body.models);
  }

  @Delete(':agentName/tiers/:tier/fallbacks')
  async clearFallbacks(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('tier') tier: string,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.routingService.clearFallbacks(agent.id, tier);
    return { ok: true };
  }

  @Post(':agentName/tiers/reset-all')
  async resetAllOverrides(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.routingService.resetAllOverrides(agent.id);
    return { ok: true };
  }

  /* ── Available models ── */

  @Get(':agentName/available-models')
  async getAvailableModels(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const models = await this.discoveryService.getModelsForAgent(agent.id);

    // Build display name map for custom providers
    const customProviders = await this.customProviderService.list(agent.id);
    const cpNameMap = new Map<string, string>();
    for (const cp of customProviders) {
      cpNameMap.set(CustomProviderService.providerKey(cp.id), cp.name);
    }

    return models.map((m) => {
      const isCustom = CustomProviderService.isCustom(m.provider);
      return {
        model_name: m.id,
        provider: m.provider,
        auth_type: m.authType ?? 'api_key',
        input_price_per_token: m.inputPricePerToken,
        output_price_per_token: m.outputPricePerToken,
        context_window: m.contextWindow,
        capability_reasoning: m.capabilityReasoning,
        capability_code: m.capabilityCode,
        quality_score: m.qualityScore,
        display_name: isCustom ? CustomProviderService.rawModelName(m.id) : m.displayName || null,
        ...(isCustom && {
          provider_display_name: cpNameMap.get(m.provider) ?? m.provider,
        }),
      };
    });
  }
}
