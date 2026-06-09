import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { TierService } from './routing-core/tier.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { PricingSyncService } from '../database/pricing-sync.service';
import {
  AgentNameParamDto,
  AgentProviderParamDto,
  AgentProviderKeyParamDto,
  ConnectProviderDto,
  RemoveProviderQueryDto,
  RenameProviderKeyDto,
  ReorderProviderKeysDto,
} from './dto/routing.dto';
import { isQwenRegion } from './qwen-region';
import { getSubscriptionEndpointRegionConfig } from './subscription-region';

@Controller('api/v1/routing')
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly tierService: TierService,
    private readonly pricingSync: PricingSyncService,
    @Optional()
    @InjectRepository(AgentProviderAccess)
    private readonly accessRepo: Repository<AgentProviderAccess> | null = null,
  ) {}

  @Get(':agentName/status')
  async getStatus(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const providers = await this.providerService.getProviders(user.id);
    const hasActiveProvider = providers.some((p) => p.is_active);

    if (!hasActiveProvider) {
      return { enabled: false, reason: 'no_provider' as const };
    }

    const hasRoutableTier = await this.tierService.hasRoutableTier(agent.id);
    if (!hasRoutableTier) {
      // No tier resolves to a model. If the OpenRouter pricing cache is empty
      // (e.g. first-boot fetch failed), surface that as a more actionable hint.
      const pricingCacheEmpty = this.pricingSync.getAll().size === 0;
      return {
        enabled: false,
        reason: pricingCacheEmpty
          ? ('pricing_cache_empty' as const)
          : ('no_routable_models' as const),
      };
    }

    return { enabled: true, reason: null };
  }

  @Get(':agentName/providers')
  async getProviders(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    // allowSystem: true — the Playground page reads the provider list for the
    // reserved system agent. Destructive/config mutations (rename, reorder,
    // deactivate, remove) still reject it; only additive connect is allowed.
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName, {
      allowSystem: true,
    });
    const providers = await this.providerService.getProviders(user.id);
    return providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      auth_type: p.auth_type ?? 'api_key',
      is_active: p.is_active,
      has_api_key: !!p.api_key_encrypted,
      key_prefix: p.key_prefix ?? null,
      label: p.label,
      priority: p.priority,
      region: p.region ?? null,
      connected_at: p.connected_at,
      models_fetched_at: p.models_fetched_at ?? null,
      cached_model_count: Array.isArray(p.cached_models) ? p.cached_models.length : 0,
    }));
  }

  @Post(':agentName/providers')
  async upsertProvider(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: ConnectProviderDto,
  ) {
    // allowSystem: true — connecting a provider to the Playground system agent
    // is additive and correct (grants belong to the user-global pool).
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName, {
      allowSystem: true,
    });
    const lowerProvider = body.provider.toLowerCase();
    const isQwenProvider = lowerProvider === 'qwen' || lowerProvider === 'alibaba';
    const subscriptionRegionConfig = getSubscriptionEndpointRegionConfig(
      lowerProvider,
      body.authType,
    );

    if (body.region !== undefined) {
      if (isQwenProvider) {
        if (!isQwenRegion(body.region)) {
          throw new BadRequestException('region must be one of: auto, singapore, us, beijing');
        }
      } else if (subscriptionRegionConfig) {
        if (!subscriptionRegionConfig.isRegion(body.region)) {
          throw new BadRequestException(subscriptionRegionConfig.validationMessage);
        }
      } else {
        throw new BadRequestException(
          'region is only supported for Alibaba/Qwen providers, MiniMax subscriptions, Xiaomi MiMo Token Plan, and Z.ai subscriptions',
        );
      }
    }

    // Sync Ollama models before connecting so tier assignment has data
    if (body.provider.toLowerCase() === 'ollama') {
      await this.ollamaSync.sync();
    }

    const { provider: result, isNew } = await this.providerService.upsertProvider(
      agent.id,
      user.id,
      body.provider,
      body.apiKey,
      body.authType,
      body.region,
      body.label,
    );
    // Insert a sparse access grant for this agent so per-agent filtering works.
    // .orIgnore() is intentional — reconnect/update flows must not throw on duplicate.
    if (this.accessRepo) {
      await this.accessRepo
        .createQueryBuilder()
        .insert()
        .into(AgentProviderAccess)
        .values({ agent_id: agent.id, user_provider_id: result.id })
        .orIgnore()
        .execute();
    }

    // Discover models and recalculate tiers before returning so the
    // frontend sees updated data immediately (typically ~1-3s).
    try {
      await this.discoveryService.discoverModels(result);
    } catch {
      // Discovery failure is non-fatal — user can retry via "Refresh models"
    }
    try {
      // A NEW provider is global + ON for every owned agent, so every sibling
      // agent must be recalced against the post-discovery model set (the grant
      // fan-out in upsertProvider ran its recalc BEFORE discovery populated
      // cached_models, so siblings would otherwise route to a stale set). An
      // existing-row reconnect only touches the connecting agent, preserving
      // each sibling's per-agent disable state.
      if (isNew) {
        await this.providerService.recalculateTiersForUser(user.id);
      } else {
        await this.providerService.recalculateTiers(agent.id, user.id);
      }
    } catch {
      // Tier recalculation failure is non-fatal
    }

    return {
      id: result.id,
      provider: result.provider,
      auth_type: result.auth_type ?? 'api_key',
      is_active: result.is_active,
      label: result.label,
      priority: result.priority,
      region: result.region ?? null,
    };
  }

  @Patch(':agentName/providers/:provider/keys/:label')
  async renameProviderKey(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentProviderKeyParamDto,
    @Body() body: RenameProviderKeyDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const updated = await this.providerService.renameKey(
      agent.id,
      user.id,
      params.provider,
      body.authType ?? 'api_key',
      params.label,
      body.newLabel,
    );
    return {
      id: updated.id,
      provider: updated.provider,
      auth_type: updated.auth_type,
      label: updated.label,
      priority: updated.priority,
    };
  }

  @Put(':agentName/providers/:provider/keys/order')
  async reorderProviderKeys(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentProviderParamDto,
    @Body() body: ReorderProviderKeysDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const updated = await this.providerService.reorderKeys(
      agent.id,
      user.id,
      params.provider,
      body.authType ?? 'api_key',
      body.labels,
    );
    return updated
      .sort((a, b) => a.priority - b.priority)
      .map((row) => ({
        id: row.id,
        label: row.label,
        priority: row.priority,
      }));
  }

  @Post(':agentName/providers/deactivate-all')
  async deactivateAllProviders(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.providerService.deactivateAllProviders(agent.id, user.id);
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
      user.id,
      params.provider,
      query.authType,
      query.label,
    );
    return { ok: true, notifications };
  }
}
