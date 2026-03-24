import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { ModelDiscoveryModule } from './model-discovery/model-discovery.module';
import { OtlpAuthGuard } from '../otlp/guards/otlp-auth.guard';
import { RoutingController } from './routing.controller';
import { CustomProviderController } from './custom-provider.controller';
import { ResolveController } from './resolve.controller';
import { ProxyController } from './proxy/proxy.controller';
import { RoutingService } from './routing.service';
import { RoutingInvalidationService } from './routing-invalidation.service';
import { RoutingCacheService } from './routing-cache.service';
import { ResolveAgentService } from './resolve-agent.service';
import { CustomProviderService } from './custom-provider.service';
import { ResolveService } from './resolve.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { ProxyService } from './proxy/proxy.service';
import { ProviderClient } from './proxy/provider-client';
import { ProxyRateLimiter } from './proxy/proxy-rate-limiter';
import { ProxyMessageRecorder } from './proxy/proxy-message-recorder';
import { SessionMomentumService } from './proxy/session-momentum.service';
import { CopilotTokenService } from './proxy/copilot-token.service';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpenaiOauthService } from './openai-oauth.service';
import { OpenaiOauthController } from './openai-oauth.controller';
import { MinimaxOauthService } from './minimax-oauth.service';
import { MinimaxOauthController } from './minimax-oauth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProvider,
      TierAssignment,
      Agent,
      Tenant,
      AgentApiKey,
      AgentMessage,
      CustomProvider,
    ]),
    ModelPricesModule,
    ModelDiscoveryModule,
    NotificationsModule,
  ],
  controllers: [
    RoutingController,
    CustomProviderController,
    ResolveController,
    ProxyController,
    OpenaiOauthController,
    MinimaxOauthController,
  ],
  providers: [
    RoutingService,
    RoutingInvalidationService,
    RoutingCacheService,
    ResolveAgentService,
    CustomProviderService,
    ResolveService,
    TierAutoAssignService,
    OtlpAuthGuard,
    ProxyService,
    ProviderClient,
    ProxyRateLimiter,
    ProxyMessageRecorder,
    SessionMomentumService,
    CopilotTokenService,
    CopilotDeviceAuthService,
    OllamaSyncService,
    OpenaiOauthService,
    MinimaxOauthService,
  ],
  exports: [
    RoutingService,
    RoutingInvalidationService,
    CustomProviderService,
    TierAutoAssignService,
    ResolveAgentService,
    OpenaiOauthService,
    MinimaxOauthService,
  ],
})
export class RoutingModule {}
