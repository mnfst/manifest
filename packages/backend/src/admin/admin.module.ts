import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { Tenant } from '../entities/tenant.entity';
import { AdminController } from './controllers/admin.controller';
import { AdminAgentController } from './controllers/admin-agent.controller';
import { AdminProviderController } from './controllers/admin-provider.controller';
import { AdminObservabilityController } from './controllers/admin-observability.controller';
import { AdminKeyService } from './services/admin-key.service';
import { AdminAiGuard } from './guards/admin-ai.guard';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RoutingCoreModule } from '../routing/routing-core/routing-core.module';
import { CustomProviderModule } from '../routing/custom-provider/custom-provider.module';
import { OtlpModule } from '../otlp/otlp.module';

/**
 * Admin API surface (`/api/v1/admin`). Thin layer over the existing
 * analytics / routing-core / otlp services — those modules own the real
 * business logic and are imported (not re-provided) so DI resolves cleanly.
 *
 * Only the admin-specific pieces are provided here:
 *  - AdminKeyService mints `mnfst_admin_ai_*` keys (api_keys rows, scope=ai_admin).
 *  - AdminAiGuard restricts the whole surface to that scope.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, Tenant]),
    AnalyticsModule,
    RoutingCoreModule,
    CustomProviderModule,
    OtlpModule,
  ],
  controllers: [
    AdminController,
    AdminAgentController,
    AdminProviderController,
    AdminObservabilityController,
  ],
  providers: [AdminKeyService, AdminAiGuard],
  exports: [AdminKeyService],
})
export class AdminModule {}
