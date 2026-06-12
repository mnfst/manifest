import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { MessageRecording } from '../../entities/message-recording.entity';
import { ReasoningContentCacheEntry } from '../../entities/reasoning-content-cache-entry.entity';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelPricesModule } from '../../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { OtlpModule } from '../../otlp/otlp.module';
import { OAuthModule } from '../oauth/oauth.module';
import { ResolveModule } from '../resolve/resolve.module';
import { CustomProviderModule } from '../custom-provider/custom-provider.module';
import { HeaderTiersModule } from '../header-tiers/header-tiers.module';
import { MessageRecordingService } from '../../analytics/services/message-recording.service';
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
import { ReasoningContentCache } from './reasoning-content-cache';
import { CodexSessionAffinity } from './codex-session-affinity';
import { ProxyExceptionFilter } from './proxy-exception.filter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentMessage,
      CustomProvider,
      MessageRecording,
      ReasoningContentCacheEntry,
    ]),
    RoutingCoreModule,
    ModelPricesModule,
    ModelDiscoveryModule,
    NotificationsModule,
    OtlpModule,
    OAuthModule,
    ResolveModule,
    CustomProviderModule,
    HeaderTiersModule,
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
    ReasoningContentCache,
    CodexSessionAffinity,
    ProxyExceptionFilter,
    MessageRecordingService,
  ],
  exports: [ProviderClient],
})
export class ProxyModule {}
