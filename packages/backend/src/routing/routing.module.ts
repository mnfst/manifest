import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../model-discovery/model-discovery.module';
import { OtlpAuthGuard } from '../otlp/guards/otlp-auth.guard';
import { RoutingCoreModule } from './routing-core/routing-core.module';
import { ProxyModule } from './proxy/proxy.module';
import { OAuthModule } from './oauth/oauth.module';
import { CustomProviderModule } from './custom-provider/custom-provider.module';
import { ProviderController } from './provider.controller';
import { TierController } from './tier.controller';
import { ModelController } from './model.controller';
import { CopilotController } from './copilot.controller';
import { ResolveController } from './resolve/resolve.controller';
import { ResolveService } from './resolve/resolve.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentApiKey]),
    RoutingCoreModule,
    ModelPricesModule,
    ModelDiscoveryModule,
    NotificationsModule,
    ProxyModule,
    OAuthModule,
    CustomProviderModule,
  ],
  controllers: [
    ProviderController,
    TierController,
    ModelController,
    CopilotController,
    ResolveController,
  ],
  providers: [ResolveService, OtlpAuthGuard, OllamaSyncService],
  exports: [RoutingCoreModule, CustomProviderModule, OAuthModule],
})
export class RoutingModule {}
