// Set MANIFEST_MODE before any entity imports so timestampType() picks up 'datetime' for sqljs
process.env['MANIFEST_MODE'] = 'local';

import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { appConfig } from '../src/config/app.config';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { sha256, keyPrefix } from '../src/common/utils/hash.util';
import { portableSql, detectDialect } from '../src/common/utils/sql-dialect';
import { AgentMessage } from '../src/entities/agent-message.entity';
import { LlmCall } from '../src/entities/llm-call.entity';
import { ToolExecution } from '../src/entities/tool-execution.entity';
import { SecurityEvent } from '../src/entities/security-event.entity';
import { ModelPricing } from '../src/entities/model-pricing.entity';
import { TokenUsageSnapshot } from '../src/entities/token-usage-snapshot.entity';
import { CostSnapshot } from '../src/entities/cost-snapshot.entity';
import { AgentLog } from '../src/entities/agent-log.entity';
import { ApiKey } from '../src/entities/api-key.entity';
import { Tenant } from '../src/entities/tenant.entity';
import { Agent } from '../src/entities/agent.entity';
import { AgentApiKey } from '../src/entities/agent-api-key.entity';
import { ModelPricingHistory } from '../src/entities/model-pricing-history.entity';
import { UnresolvedModel } from '../src/entities/unresolved-model.entity';
import { NotificationRule } from '../src/entities/notification-rule.entity';
import { NotificationLog } from '../src/entities/notification-log.entity';
import { UserProvider } from '../src/entities/user-provider.entity';
import { TierAssignment } from '../src/entities/tier-assignment.entity';
import { HealthModule } from '../src/health/health.module';
import { TelemetryModule } from '../src/telemetry/telemetry.module';
import { AnalyticsModule } from '../src/analytics/analytics.module';
import { SecurityModule } from '../src/security/security.module';
import { OtlpModule } from '../src/otlp/otlp.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { ModelPricesModule } from '../src/model-prices/model-prices.module';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { RoutingModule } from '../src/routing/routing.module';
import { CommonModule } from '../src/common/common.module';

export const TEST_USER_ID = 'test-user-001';
export const TEST_API_KEY = 'test-api-key-001';
export const TEST_TENANT_ID = 'test-tenant-001';
export const TEST_AGENT_ID = 'test-agent-001';
export const TEST_OTLP_KEY = 'mnfst_test-otlp-key-001';

const entities = [AgentMessage, LlmCall, ToolExecution, SecurityEvent, ModelPricing, ModelPricingHistory, UnresolvedModel, TokenUsageSnapshot, CostSnapshot, AgentLog, ApiKey, Tenant, Agent, AgentApiKey, NotificationRule, NotificationLog, UserProvider, TierAssignment];

function buildTypeOrmConfig(): TypeOrmModuleOptions {
  return {
    type: 'sqljs' as const,
    entities,
    synchronize: true,
    dropSchema: true,
    logging: false,
  };
}

@Injectable()
class MockSessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = { id: TEST_USER_ID, email: 'test@test.com', name: 'Test' };
    request.session = { id: 'test-session', userId: TEST_USER_ID };
    return true;
  }
}

export async function createTestApp(): Promise<INestApplication> {
  process.env['API_KEY'] = TEST_API_KEY;
  process.env['NODE_ENV'] = 'test';
  process.env['BETTER_AUTH_SECRET'] = process.env['BETTER_AUTH_SECRET'] ?? 'test-secret-for-e2e-at-least-32chars!!';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
      CacheModule.register({ isGlobal: true, ttl: 5000 }),
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
      TypeOrmModule.forRoot(buildTypeOrmConfig()),
      TypeOrmModule.forFeature(entities),
      CommonModule,
      HealthModule,
      TelemetryModule,
      AnalyticsModule,
      SecurityModule,
      OtlpModule,
      NotificationsModule,
      ModelPricesModule,
      RoutingModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: MockSessionGuard },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (query: string) => portableSql(query, dialect);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  // Seed test API key (hashed)
  await ds.query(
    sql(`INSERT INTO api_keys (id, key, key_hash, key_prefix, user_id, name, created_at) VALUES ($1, NULL, $2, $3, $4, $5, $6)`),
    ['test-key-id', sha256(TEST_API_KEY), keyPrefix(TEST_API_KEY), TEST_USER_ID, 'Test Key', now],
  );

  // Seed test tenant, agent, and OTLP key (hashed)
  await ds.query(
    sql(`INSERT INTO tenants (id, name, organization_name, is_active, created_at, updated_at) VALUES ($1,$2,$3,true,$4,$5)`),
    [TEST_TENANT_ID, TEST_USER_ID, 'Test Org', now, now],
  );
  await ds.query(
    sql(`INSERT INTO agents (id, name, display_name, description, is_active, tenant_id, created_at, updated_at) VALUES ($1,$2,$3,$4,true,$5,$6,$7)`),
    [TEST_AGENT_ID, 'test-agent', 'Test Agent', 'Test agent', TEST_TENANT_ID, now, now],
  );
  await ds.query(
    sql(`INSERT INTO agent_api_keys (id, key, key_hash, key_prefix, label, tenant_id, agent_id, is_active, created_at) VALUES ($1, NULL, $2, $3, $4, $5, $6, true, $7)`),
    ['test-otlp-key-id', sha256(TEST_OTLP_KEY), keyPrefix(TEST_OTLP_KEY), 'Test OTLP Key', TEST_TENANT_ID, TEST_AGENT_ID, now],
  );

  // Seed model pricing so cost calculations work in e2e tests
  await ds.query(
    sql(`INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token) VALUES ($1,$2,$3,$4)`),
    ['claude-opus-4-6', 'Anthropic', 0.000015, 0.000075],
  );
  await ds.query(
    sql(`INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token) VALUES ($1,$2,$3,$4)`),
    ['gpt-4o', 'OpenAI', 0.0000025, 0.00001],
  );

  // Reload pricing cache so cost calculations use the seeded data
  const pricingCache = app.get(ModelPricingCacheService);
  await pricingCache.reload();

  return app;
}
