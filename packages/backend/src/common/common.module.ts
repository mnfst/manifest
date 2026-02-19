import { Global, Module } from '@nestjs/common';
import { IngestEventBusService } from './services/ingest-event-bus.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { UserCacheInterceptor } from './interceptors/user-cache.interceptor';

@Global()
@Module({
  providers: [IngestEventBusService, CacheInvalidationService, UserCacheInterceptor],
  exports: [IngestEventBusService, CacheInvalidationService, UserCacheInterceptor],
})
export class CommonModule {}
