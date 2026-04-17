import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { CustomProviderService } from './custom-provider/custom-provider.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { PricingSyncService } from '../database/pricing-sync.service';
import { AgentNameParamDto } from './dto/routing.dto';

@Controller('api/v1/routing')
export class ModelController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly customProviderService: CustomProviderService,
    private readonly pricingSync: PricingSyncService,
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
