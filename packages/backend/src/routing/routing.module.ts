import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { CopilotController } from './oauth/copilot/copilot.controller';
import { SpecificityController } from './specificity.controller';
import { ModelParamsController } from './model-params.controller';
import { TenantProvidersController } from './tenant-providers.controller';
import { AgentEnabledProvidersController } from './agent-enabled-providers.controller';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { AgentEnabledProvider } from '../entities/agent-enabled-provider.entity';
import { Agent } from '../entities/agent.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { Tenant } from '../entities/tenant.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../entities/specificity-assignment.entity';
import { HeaderTier } from '../entities/header-tier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantProvider,
      AgentEnabledProvider,
      Agent,
      AgentMessage,
      Tenant,
      TierAssignment,
      SpecificityAssignment,
      HeaderTier,
    ]),
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
    ModelParamsController,
    TenantProvidersController,
    AgentEnabledProvidersController,
  ],
  providers: [OllamaSyncService],
  exports: [RoutingCoreModule, CustomProviderModule, OAuthModule],
})
export class RoutingModule {}
