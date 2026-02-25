import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { RoutingService } from './routing.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { expandProviderNames } from './provider-aliases';
import { trackCloudEvent } from '../common/utils/product-telemetry';
import {
  TierParamDto,
  ProviderParamDto,
  ConnectProviderDto,
  SetOverrideDto,
} from './dto/routing.dto';

@Controller('api/v1/routing')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  /* ── Providers ── */

  @Get('providers')
  async getProviders(@CurrentUser() user: AuthUser) {
    const providers = await this.routingService.getProviders(user.id);
    return providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      is_active: p.is_active,
      has_api_key: !!p.api_key_encrypted,
      key_prefix: this.routingService.getKeyPrefix(p.api_key_encrypted),
      connected_at: p.connected_at,
    }));
  }

  @Post('providers')
  async upsertProvider(
    @CurrentUser() user: AuthUser,
    @Body() body: ConnectProviderDto,
  ) {
    const { provider: result, isNew } =
      await this.routingService.upsertProvider(
        user.id,
        body.provider,
        body.apiKey,
      );

    if (isNew) {
      trackCloudEvent('routing_provider_connected', user.id, {
        provider: body.provider,
      });
    }

    return {
      id: result.id,
      provider: result.provider,
      is_active: result.is_active,
    };
  }

  @Post('providers/deactivate-all')
  async deactivateAllProviders(@CurrentUser() user: AuthUser) {
    await this.routingService.deactivateAllProviders(user.id);
    return { ok: true };
  }

  @Delete('providers/:provider')
  async removeProvider(
    @CurrentUser() user: AuthUser,
    @Param() params: ProviderParamDto,
  ) {
    const { notifications } = await this.routingService.removeProvider(
      user.id,
      params.provider,
    );
    return { ok: true, notifications };
  }

  /* ── Tiers ── */

  @Get('tiers')
  async getTiers(@CurrentUser() user: AuthUser) {
    return this.routingService.getTiers(user.id);
  }

  @Put('tiers/:tier')
  async setOverride(
    @CurrentUser() user: AuthUser,
    @Param() params: TierParamDto,
    @Body() body: SetOverrideDto,
  ) {
    return this.routingService.setOverride(user.id, params.tier, body.model);
  }

  @Delete('tiers/:tier')
  async clearOverride(
    @CurrentUser() user: AuthUser,
    @Param() params: TierParamDto,
  ) {
    await this.routingService.clearOverride(user.id, params.tier);
    return { ok: true };
  }

  @Post('tiers/reset-all')
  async resetAllOverrides(@CurrentUser() user: AuthUser) {
    await this.routingService.resetAllOverrides(user.id);
    return { ok: true };
  }

  /* ── Available models ── */

  @Get('available-models')
  async getAvailableModels(@CurrentUser() user: AuthUser) {
    const providers = await this.routingService.getProviders(user.id);
    const activeProviders = expandProviderNames(
      providers.filter((p) => p.is_active).map((p) => p.provider),
    );

    const models = this.pricingCache.getAll();
    return models
      .filter((m) => activeProviders.has(m.provider.toLowerCase()))
      .map((m) => ({
        model_name: m.model_name,
        provider: m.provider,
        input_price_per_token: m.input_price_per_token,
        output_price_per_token: m.output_price_per_token,
        context_window: m.context_window,
        capability_reasoning: m.capability_reasoning,
        capability_code: m.capability_code,
        quality_score: m.quality_score,
      }));
  }
}
