import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { Agent } from '../../entities/agent.entity';
import { Tenant } from '../../entities/tenant.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ModelPricesModule } from '../../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { ProviderService } from './provider.service';
import { TierService } from './tier.service';
import { ProviderKeyService } from './provider-key.service';
import { RoutingCacheService } from './routing-cache.service';
import { RoutingInvalidationService } from './routing-invalidation.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { ResolveAgentService } from './resolve-agent.service';
import { SpecificityService } from './specificity.service';
import { SpecificityPenaltyService } from './specificity-penalty.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProvider,
      TierAssignment,
      SpecificityAssignment,
      Agent,
      Tenant,
      AgentMessage,
    ]),
    ModelPricesModule,
    ModelDiscoveryModule,
  ],
  providers: [
    ProviderService,
    TierService,
    ProviderKeyService,
    RoutingCacheService,
    RoutingInvalidationService,
    TierAutoAssignService,
    ResolveAgentService,
    SpecificityService,
    SpecificityPenaltyService,
  ],
  exports: [
    TypeOrmModule,
    ProviderService,
    TierService,
    ProviderKeyService,
    RoutingCacheService,
    RoutingInvalidationService,
    TierAutoAssignService,
    ResolveAgentService,
    SpecificityService,
    SpecificityPenaltyService,
  ],
})
export class RoutingCoreModule {}
