import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelPricesModule } from '../../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { OtlpModule } from '../../otlp/otlp.module';
import { OAuthModule } from '../oauth/oauth.module';
import { ResolveModule } from '../resolve/resolve.module';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { ProxyFallbackService } from './proxy-fallback.service';
import { ProviderClient } from './provider-client';
import { ProxyRateLimiter } from './proxy-rate-limiter';
import { ProxyMessageRecorder } from './proxy-message-recorder';
import { ProxyMessageDedup } from './proxy-message-dedup';
import { SessionMomentumService } from './session-momentum.service';
import { CopilotTokenService } from './copilot-token.service';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { ProxyExceptionFilter } from './proxy-exception.filter';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentMessage, CustomProvider]),
    RoutingCoreModule,
    ModelPricesModule,
    ModelDiscoveryModule,
    NotificationsModule,
    OtlpModule,
    OAuthModule,
    ResolveModule,
  ],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    ProxyFallbackService,
    ProviderClient,
    ProxyRateLimiter,
    ProxyMessageRecorder,
    ProxyMessageDedup,
    SessionMomentumService,
    CopilotTokenService,
    ThoughtSignatureCache,
    ThinkingBlockCache,
    ProxyExceptionFilter,
  ],
})
export class ProxyModule {}
