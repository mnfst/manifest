import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { CopilotDeviceAuthService } from './oauth/copilot-device-auth.service';
import { ProviderService } from './routing-core/provider.service';
import {
  CopilotPollDto,
  ConnectProviderDto,
  ProviderKeyParamDto,
  RemoveProviderQueryDto,
  RenameProviderKeyDto,
  ReorderProviderKeysDto,
} from './dto/routing.dto';
import { assertProviderRegionSupported } from './provider-region-validation';
import { serializeProviderConnection } from './provider-response';

@Controller('api/v1/providers')
export class GlobalProvidersController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly ollamaSync: OllamaSyncService,
    private readonly copilotAuth?: CopilotDeviceAuthService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const providers = await this.providerService.getGlobalProviders(user.id);
    return providers.map(serializeProviderConnection);
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

    return serializeProviderConnection(provider);
  }

  @Patch(':provider/keys/:label')
  async renameKey(
    @CurrentUser() user: AuthUser,
    @Param() params: ProviderKeyParamDto,
    @Body() body: RenameProviderKeyDto,
  ) {
    const updated = await this.providerService.renameGlobalKey(
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

  @Post('copilot/device-code')
  async copilotDeviceCode() {
    if (!this.copilotAuth) throw new Error('Copilot device auth is not configured');
    return this.copilotAuth.requestDeviceCode();
  }

  @Post('copilot/poll-token')
  async copilotPollToken(@CurrentUser() user: AuthUser, @Body() body: CopilotPollDto) {
    if (!this.copilotAuth) throw new Error('Copilot device auth is not configured');
    const result = await this.copilotAuth.pollForToken(body.deviceCode);
    if (result.status === 'complete' && result.token) {
      const scope = { type: 'global' as const, userId: user.id };
      const label = await this.providerService.nextOAuthLabelForConnection(scope, 'copilot');
      const { provider } = await this.providerService.upsertProviderForConnection(
        scope,
        'copilot',
        result.token,
        'subscription',
        undefined,
        label,
      );
      try {
        await this.discoveryService.discoverModels(provider);
      } catch {
        // Discovery failure is non-fatal.
      }
    }
    return { status: result.status };
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
