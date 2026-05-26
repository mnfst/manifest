import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { CustomProviderService } from './custom-provider/custom-provider.service';
import { ProviderParamSpecService } from './routing-core/provider-param-spec.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { PricingSyncService } from '../database/pricing-sync.service';
import { ModelsDevSyncService } from '../database/models-dev-sync.service';
import { resolveUnderlyingModelIdentity } from 'manifest-shared';
import {
  mergeModelCapabilities,
  modelSupportsStreaming,
} from '../model-discovery/model-capabilities';
import {
  AgentNameParamDto,
  AgentProviderParamDto,
  RemoveProviderQueryDto,
} from './dto/routing.dto';

@Controller('api/v1/routing')
export class ModelController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly customProviderService: CustomProviderService,
    private readonly pricingSync: PricingSyncService,
    private readonly providerParamSpecs: ProviderParamSpecService,
    private readonly modelsDevSync: ModelsDevSyncService,
  ) {}

  @Get('pricing-health')
  pricingHealth() {
    return {
      model_count: this.pricingSync.getAll().size,
      last_fetched_at: this.pricingSync.getLastFetchedAt()?.toISOString() ?? null,
    };
  }

  @Post('pricing/refresh')
  async refreshPricing() {
    const modelCount = await this.pricingSync.refreshCache();
    return {
      ok: modelCount > 0,
      model_count: modelCount,
      last_fetched_at: this.pricingSync.getLastFetchedAt()?.toISOString() ?? null,
    };
  }

  @Post(':agentName/refresh-models')
  async refreshModels(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.discoveryService.discoverAllForAgent(agent.id);
    await this.providerService.recalculateTiers(agent.id);
    return { ok: true };
  }

  @Post(':agentName/providers/:provider/refresh-models')
  async refreshProviderModels(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentProviderParamDto,
    @Query() query: RemoveProviderQueryDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const result = await this.discoveryService.refreshProvider(
      agent.id,
      params.provider,
      query.authType,
    );
    if (result.ok) {
      await this.providerService.recalculateTiers(agent.id);
    }
    return result;
  }

  @Post('ollama/sync')
  async syncOllama() {
    return this.ollamaSync.sync();
  }

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

    return Promise.all(
      models.map(async (m) => {
        const isCustom = CustomProviderService.isCustom(m.provider);
        const authType = m.authType ?? 'api_key';
        const capabilities = await this.providerParamSpecs.getCapabilities(
          m.provider,
          authType,
          m.id,
        );
        // Gateway models (e.g. `opencode-go/glm-5.1`) proxy another provider's
        // API, so their capabilities live under the underlying provider on
        // models.dev. Resolve the provenance before the metadata lookups; this
        // is gateway-generic, not OpenCode Go-specific. `getCapabilities` (MPS)
        // already unwraps gateways internally, so it keeps the raw identity.
        const capId = resolveUnderlyingModelIdentity(m.provider, m.id);
        const capProvider = capId.provider ?? m.provider;
        const modelsDevCapabilities = this.modelsDevSync.lookupModel(
          capProvider,
          capId.model,
        )?.capabilities;
        const modelCapabilities = mergeModelCapabilities(
          m.capabilities,
          modelsDevCapabilities,
          capabilities,
          modelSupportsStreaming(capProvider, capId.model) ? ['stream'] : undefined,
        );
        return {
          model_name: m.id,
          provider: m.provider,
          auth_type: authType,
          input_price_per_token: m.inputPricePerToken,
          output_price_per_token: m.outputPricePerToken,
          context_window: m.contextWindow,
          capability_reasoning: m.capabilityReasoning,
          capability_code: m.capabilityCode,
          ...(modelCapabilities ? { capabilities: modelCapabilities } : {}),
          quality_score: m.qualityScore,
          display_name: isCustom ? CustomProviderService.rawModelName(m.id) : m.displayName || null,
          ...(isCustom && {
            provider_display_name: cpNameMap.get(m.provider) ?? m.provider,
          }),
        };
      }),
    );
  }
}
