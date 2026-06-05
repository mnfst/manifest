import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { ProviderService } from './routing-core/provider.service';
import {
  ConnectProviderDto,
  RemoveProviderQueryDto,
  RenameProviderKeyDto,
  ReorderProviderKeysDto,
} from './dto/routing.dto';
import { assertProviderRegionSupported } from './provider-region-validation';

function serializeProvider(p: Awaited<ReturnType<ProviderService['getGlobalProviders']>>[number]) {
  return {
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
  };
}

@Controller('api/v1/providers')
export class GlobalProvidersController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const providers = await this.providerService.getGlobalProviders(user.id);
    return providers.map(serializeProvider);
  }

  @Post()
  async upsert(@CurrentUser() user: AuthUser, @Body() body: ConnectProviderDto) {
    assertProviderRegionSupported(body.provider, body.authType, body.region);

    if (body.provider.toLowerCase() === 'ollama') {
      await this.ollamaSync.sync();
    }

    const { provider } = await this.providerService.upsertGlobalProvider(
      user.id,
      body.provider,
      body.apiKey,
      body.authType,
      body.region,
      body.label,
    );

    try {
      await this.discoveryService.discoverModels(provider);
    } catch {
      // Global provider connection should survive a transient model fetch failure.
    }

    return serializeProvider(provider);
  }

  @Patch(':provider/keys/:label')
  async renameKey(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: string,
    @Param('label') label: string,
    @Body() body: RenameProviderKeyDto,
  ) {
    const updated = await this.providerService.renameGlobalKey(
      user.id,
      provider,
      body.authType ?? 'api_key',
      label,
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

  @Put(':provider/keys/order')
  async reorderKeys(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: string,
    @Body() body: ReorderProviderKeysDto,
  ) {
    const updated = await this.providerService.reorderGlobalKeys(
      user.id,
      provider,
      body.authType ?? 'api_key',
      body.labels,
    );
    return updated
      .sort((a, b) => a.priority - b.priority)
      .map((row) => ({ id: row.id, label: row.label, priority: row.priority }));
  }

  @Post(':provider/refresh-models')
  async refreshProviderModels(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: string,
    @Query() query: RemoveProviderQueryDto,
  ) {
    return this.discoveryService.refreshGlobalProvider(user.id, provider, query.authType);
  }

  @Delete(':provider')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: string,
    @Query() query: RemoveProviderQueryDto,
  ) {
    const { notifications } = await this.providerService.removeGlobalProvider(
      user.id,
      provider,
      query.authType,
      query.label,
    );
    return { ok: true, notifications };
  }
}
