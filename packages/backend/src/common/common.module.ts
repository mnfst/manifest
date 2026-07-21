import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { IngestEventBusService } from './services/ingest-event-bus.service';
import { ManifestRuntimeService } from './services/manifest-runtime.service';
import { TenantCacheService } from './services/tenant-cache.service';
import { UserCacheInterceptor } from './interceptors/user-cache.interceptor';
import { AgentCacheInterceptor } from './interceptors/agent-cache.interceptor';
import { LocaleService } from './services/locale.service';
import { LocalizationController } from './localization.controller';
import { SessionOnlyGuard } from './guards/session-only.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Agent])],
  providers: [
    IngestEventBusService,
    ManifestRuntimeService,
    TenantCacheService,
    UserCacheInterceptor,
    AgentCacheInterceptor,
    LocaleService,
    SessionOnlyGuard,
  ],
  exports: [
    IngestEventBusService,
    ManifestRuntimeService,
    TenantCacheService,
    UserCacheInterceptor,
    AgentCacheInterceptor,
    LocaleService,
  ],
  controllers: [LocalizationController],
})
export class CommonModule {}
