import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { AgentEnabledProvider } from '../entities/agent-enabled-provider.entity';
import { AdminController } from './controllers/admin.controller';
import { AdminAgentController } from './controllers/admin-agent.controller';
import { AdminProviderController } from './controllers/admin-provider.controller';
import { AdminObservabilityController } from './controllers/admin-observability.controller';
import { AdminKeyService } from './services/admin-key.service';
import { AdminAiGuard } from './guards/admin-ai.guard';
import { AgentLifecycleService } from '../analytics/services/agent-lifecycle.service';
import { ApiKeyGeneratorService } from '../otlp/services/api-key.service';
import { AgentDuplicationService } from '../analytics/services/agent-duplication.service';
import { ProviderService } from '../routing/routing-core/provider.service';
import { ProviderKeyService } from '../routing/routing-core/provider-key.service';
import { CustomProviderService } from '../routing/custom-provider/custom-provider.service';
import { TimeseriesQueriesService } from '../analytics/services/timeseries-queries.service';
import { RoutingCacheService } from '../routing/routing-core/routing-cache.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';

/**
 * Scoped AI-administration surface. Mounts the AdminController (key
 * self-management) and AdminAgentController (agent CRUD over existing
 * services), both gated by AdminAiGuard. Depends only on entities already
 * managed by the global TypeORM feature list and services that are already
 * singletons in the app — no new provider wiring beyond what those services
 * themselves require.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, Tenant, Agent, AgentApiKey, AgentEnabledProvider])],
  controllers: [AdminController, AdminAgentController, AdminProviderController, AdminObservabilityController],
  providers: [
    AdminKeyService,
    AdminAiGuard,
    AgentLifecycleService,
    ApiKeyGeneratorService,
    AgentDuplicationService,
    ProviderService,
    ProviderKeyService,
    CustomProviderService,
    TimeseriesQueriesService,
    AdminObservabilityController,
    RoutingCacheService,
    ResolveAgentService,
    ModelPricingCacheService,
    ModelDiscoveryService,
    IngestEventBusService,
  ],
  exports: [AdminKeyService],
})
export class AdminModule {}
