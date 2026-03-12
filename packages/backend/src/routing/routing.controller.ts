import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { RoutingService } from './routing.service';
import { ResolveAgentService } from './resolve-agent.service';
import { CustomProviderService } from './custom-provider.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';
import { expandProviderNames, inferProviderFromModelName } from './provider-aliases';
import { trackCloudEvent } from '../common/utils/product-telemetry';
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
    private readonly pricingCache: ModelPricingCacheService,
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

    if (isNew) {
      trackCloudEvent('routing_provider_connected', user.id, {
        provider: body.provider,
      });
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
      await this.routingService.upsertProvider(
        agent.id,
        user.id,
        'copilot',
        result.token,
        'subscription',
      );
      trackCloudEvent('routing_provider_connected', user.id, { provider: 'copilot' });
    }
    return { status: result.status };
  }

  /* ── Ollama sync ── */

  @Post('ollama/sync')
  async syncOllama() {
    return this.ollamaSync.sync();
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
    return this.routingService.setOverride(agent.id, user.id, tier, body.model, body.authType);
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
    const providers = await this.routingService.getProviders(agent.id);
    const activeProviders = expandProviderNames(
      providers.filter((p) => p.is_active).map((p) => p.provider),
    );

    // Build display name map for custom providers
    const customProviders = await this.customProviderService.list(agent.id);
    const cpNameMap = new Map<string, string>();
    for (const cp of customProviders) {
      cpNameMap.set(CustomProviderService.providerKey(cp.id), cp.name);
    }

    const models = this.pricingCache.getAll();
    return models
      .filter((m) => {
        if (activeProviders.has(m.provider.toLowerCase())) return true;
        const prefix = inferProviderFromModelName(m.model_name);
        return prefix != null && activeProviders.has(prefix);
      })
      .map((m) => {
        const isCustom = CustomProviderService.isCustom(m.provider);
        return {
          model_name: m.model_name,
          provider: m.provider,
          input_price_per_token: m.input_price_per_token,
          output_price_per_token: m.output_price_per_token,
          context_window: m.context_window,
          capability_reasoning: m.capability_reasoning,
          capability_code: m.capability_code,
          quality_score: m.quality_score,
          display_name: isCustom
            ? CustomProviderService.rawModelName(m.model_name)
            : m.display_name || null,
          ...(isCustom && {
            provider_display_name: cpNameMap.get(m.provider) ?? m.provider,
          }),
        };
      });
  }
}
