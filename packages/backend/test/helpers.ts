import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { appConfig } from '../src/config/app.config';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { sha256, keyPrefix } from '../src/common/utils/hash.util';
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
import { NotificationRule } from '../src/entities/notification-rule.entity';
import { NotificationLog } from '../src/entities/notification-log.entity';
import { HealthModule } from '../src/health/health.module';
import { TelemetryModule } from '../src/telemetry/telemetry.module';
import { AnalyticsModule } from '../src/analytics/analytics.module';
import { SecurityModule } from '../src/security/security.module';
import { OtlpModule } from '../src/otlp/otlp.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { ModelPricesModule } from '../src/model-prices/model-prices.module';
import { CommonModule } from '../src/common/common.module';

export const TEST_USER_ID = 'test-user-001';
export const TEST_API_KEY = 'test-api-key-001';
export const TEST_TENANT_ID = 'test-tenant-001';
export const TEST_AGENT_ID = 'test-agent-001';
export const TEST_OTLP_KEY = 'test-otlp-key-001';

const entities = [AgentMessage, LlmCall, ToolExecution, SecurityEvent, ModelPricing, TokenUsageSnapshot, CostSnapshot, AgentLog, ApiKey, Tenant, Agent, AgentApiKey, NotificationRule, NotificationLog];

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
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: process.env['DATABASE_URL'] || 'postgresql://myuser:mypassword@localhost:5432/mydatabase',
        entities,
        synchronize: true,
        dropSchema: true,
        logging: false,
      }),
      TypeOrmModule.forFeature(entities),
      CommonModule,
      HealthModule,
      TelemetryModule,
      AnalyticsModule,
      SecurityModule,
      OtlpModule,
      NotificationsModule,
      ModelPricesModule,
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

  // Seed test API key (hashed)
  const ds = app.get(DataSource);
  await ds.query(
    `INSERT INTO api_keys (id, key, key_hash, key_prefix, user_id, name, created_at) VALUES ($1, NULL, $2, $3, $4, $5, NOW())`,
    ['test-key-id', sha256(TEST_API_KEY), keyPrefix(TEST_API_KEY), TEST_USER_ID, 'Test Key'],
  );

  // Seed test tenant, agent, and OTLP key (hashed)
  await ds.query(
    `INSERT INTO tenants (id, name, organization_name, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,true,NOW(),NOW())`,
    [TEST_TENANT_ID, 'test-tenant', 'Test Org'],
  );
  await ds.query(
    `INSERT INTO agents (id, name, description, is_active, tenant_id, created_at, updated_at)
     VALUES ($1,$2,$3,true,$4,NOW(),NOW())`,
    [TEST_AGENT_ID, 'test-agent', 'Test agent', TEST_TENANT_ID],
  );
  await ds.query(
    `INSERT INTO agent_api_keys (id, key, key_hash, key_prefix, label, tenant_id, agent_id, is_active, created_at)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, true, NOW())`,
    ['test-otlp-key-id', sha256(TEST_OTLP_KEY), keyPrefix(TEST_OTLP_KEY), 'Test OTLP Key', TEST_TENANT_ID, TEST_AGENT_ID],
  );

  return app;
}
