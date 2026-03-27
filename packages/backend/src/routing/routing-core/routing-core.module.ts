import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { Agent } from '../../entities/agent.entity';
import { Tenant } from '../../entities/tenant.entity';
import { ModelPricesModule } from '../../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { ProviderService } from './provider.service';
import { TierService } from './tier.service';
import { ProviderKeyService } from './provider-key.service';
import { RoutingCacheService } from './routing-cache.service';
import { RoutingInvalidationService } from './routing-invalidation.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { ResolveAgentService } from './resolve-agent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProvider, TierAssignment, Agent, Tenant]),
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
  ],
})
export class RoutingCoreModule {}
