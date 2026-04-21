import { Module } from '@nestjs/common';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../model-discovery/model-discovery.module';
import { OtlpModule } from '../otlp/otlp.module';
import { RoutingCoreModule } from './routing-core/routing-core.module';
import { ProxyModule } from './proxy/proxy.module';
import { OAuthModule } from './oauth/oauth.module';
import { CustomProviderModule } from './custom-provider/custom-provider.module';
import { ResolveModule } from './resolve/resolve.module';
import { HeaderTiersModule } from './header-tiers/header-tiers.module';
import { ProviderController } from './provider.controller';
import { TierController } from './tier.controller';
import { ModelController } from './model.controller';
import { CopilotController } from './copilot.controller';
import { SpecificityController } from './specificity.controller';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    RoutingCoreModule,
    ModelPricesModule,
    ModelDiscoveryModule,
    NotificationsModule,
    OtlpModule,
    ProxyModule,
    OAuthModule,
    CustomProviderModule,
    ResolveModule,
    HeaderTiersModule,
  ],
  controllers: [
    ProviderController,
    TierController,
    ModelController,
    CopilotController,
    SpecificityController,
  ],
  providers: [OllamaSyncService],
  exports: [RoutingCoreModule, CustomProviderModule, OAuthModule],
})
export class RoutingModule {}
