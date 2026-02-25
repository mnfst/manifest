import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { OtlpAuthGuard } from '../otlp/guards/otlp-auth.guard';
import { RoutingController } from './routing.controller';
import { ResolveController } from './resolve.controller';
import { ProxyController } from './proxy/proxy.controller';
import { RoutingService } from './routing.service';
import { ResolveService } from './resolve.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { ProxyService } from './proxy/proxy.service';
import { ProviderClient } from './proxy/provider-client';
import { SessionMomentumService } from './proxy/session-momentum.service';
import { OllamaSyncService } from '../database/ollama-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProvider, TierAssignment, AgentApiKey, ModelPricing]),
    ModelPricesModule,
  ],
  controllers: [RoutingController, ResolveController, ProxyController],
  providers: [
    RoutingService,
    ResolveService,
    TierAutoAssignService,
    OtlpAuthGuard,
    ProxyService,
    ProviderClient,
    SessionMomentumService,
    OllamaSyncService,
  ],
  exports: [RoutingService, TierAutoAssignService],
})
export class RoutingModule {}
