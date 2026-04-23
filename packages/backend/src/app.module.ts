import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from './config/app.config';
import { resolveFrontendDir } from './common/utils/frontend-path';
import { DASHBOARD_CACHE_TTL_MS } from './common/constants/cache.constants';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { ApiKey } from './entities/api-key.entity';
import { SessionGuard } from './auth/session.guard';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OtlpModule } from './otlp/otlp.module';
import { ModelPricesModule } from './model-prices/model-prices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RoutingModule } from './routing/routing.module';
import { CommonModule } from './common/common.module';
import { SseModule } from './sse/sse.module';
import { GithubModule } from './github/github.module';
import { PublicStatsModule } from './public-stats/public-stats.module';
import { SetupModule } from './setup/setup.module';
import { FreeModelsModule } from './free-models/free-models.module';
import { TelemetryModule } from './telemetry/telemetry.module';

const frontendPath = resolveFrontendDir();
const ONE_YEAR_S = 365 * 24 * 60 * 60;
const serveStaticImports = frontendPath
  ? [
      ServeStaticModule.forRoot({
        rootPath: frontendPath,
        renderPath: '/__serve_static_never_match',
        exclude: ['/api/{*path}', '/v1/{*path}'],
        serveStaticOptions: {
          maxAge: ONE_YEAR_S * 1000,
          immutable: true,
          setHeaders: (res: { setHeader: (name: string, value: string) => void }, path: string) => {
            // index.html must never be cached (SPA entry point)
            if (path.endsWith('.html') || path.endsWith('/index.html')) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        },
      }),
    ]
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
    AnalyticsModule,
    OtlpModule,
    ModelPricesModule,
    NotificationsModule,
    RoutingModule,
    SseModule,
    GithubModule,
    PublicStatsModule,
    SetupModule,
    FreeModelsModule,
    TelemetryModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
