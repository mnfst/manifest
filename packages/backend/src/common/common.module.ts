import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { IngestEventBusService } from './services/ingest-event-bus.service';
import { ManifestRuntimeService } from './services/manifest-runtime.service';
import { TenantCacheService } from './services/tenant-cache.service';
import { UserCacheInterceptor } from './interceptors/user-cache.interceptor';
import { AgentCacheInterceptor } from './interceptors/agent-cache.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [
    IngestEventBusService,
    ManifestRuntimeService,
    TenantCacheService,
    UserCacheInterceptor,
    AgentCacheInterceptor,
  ],
  exports: [
    IngestEventBusService,
    ManifestRuntimeService,
    TenantCacheService,
    UserCacheInterceptor,
    AgentCacheInterceptor,
  ],
})
export class CommonModule {}
