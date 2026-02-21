import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { existsSync } from 'fs';
import { appConfig } from './config/app.config';
import { DASHBOARD_CACHE_TTL_MS } from './common/constants/cache.constants';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { ApiKey } from './entities/api-key.entity';
import { SessionGuard } from './auth/session.guard';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SecurityModule } from './security/security.module';
import { OtlpModule } from './otlp/otlp.module';
import { ModelPricesModule } from './model-prices/model-prices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RoutingModule } from './routing/routing.module';
import { CommonModule } from './common/common.module';
import { SseModule } from './sse/sse.module';

const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');
const serveStaticImports = existsSync(frontendPath)
  ? [ServeStaticModule.forRoot({ rootPath: frontendPath, exclude: ['/api/{*path}', '/otlp/{*path}'] })]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    CacheModule.register({ isGlobal: true, ttl: DASHBOARD_CACHE_TTL_MS }),
    ...serveStaticImports,
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env['THROTTLE_TTL'] ?? 60000),
        limit: Number(process.env['THROTTLE_LIMIT'] ?? 100),
      },
    ]),
    CommonModule,
    DatabaseModule,
    TypeOrmModule.forFeature([ApiKey]),
    AuthModule,
    HealthModule,
    TelemetryModule,
    AnalyticsModule,
    SecurityModule,
    OtlpModule,
    ModelPricesModule,
    NotificationsModule,
    RoutingModule,
    SseModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
