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
import { hashKey, keyPrefix } from '../src/common/utils/hash.util';
import { AgentMessage } from '../src/entities/agent-message.entity';
import { LlmCall } from '../src/entities/llm-call.entity';
import { ToolExecution } from '../src/entities/tool-execution.entity';
import { AgentLog } from '../src/entities/agent-log.entity';
import { ApiKey } from '../src/entities/api-key.entity';
import { Tenant } from '../src/entities/tenant.entity';
import { Agent } from '../src/entities/agent.entity';
import { AgentApiKey } from '../src/entities/agent-api-key.entity';
import { NotificationRule } from '../src/entities/notification-rule.entity';
import { NotificationLog } from '../src/entities/notification-log.entity';
import { UserProvider } from '../src/entities/user-provider.entity';
import { TierAssignment } from '../src/entities/tier-assignment.entity';
import { CustomProvider } from '../src/entities/custom-provider.entity';
import { EmailProviderConfig } from '../src/entities/email-provider-config.entity';
import { SpecificityAssignment } from '../src/entities/specificity-assignment.entity';
import { HeaderTier } from '../src/entities/header-tier.entity';
import { InstallMetadata } from '../src/entities/install-metadata.entity';
import { HealthModule } from '../src/health/health.module';
import { AnalyticsModule } from '../src/analytics/analytics.module';
import { OtlpModule } from '../src/otlp/otlp.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { ModelPricesModule } from '../src/model-prices/model-prices.module';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { RoutingModule } from '../src/routing/routing.module';
import { CommonModule } from '../src/common/common.module';
import { PublicStatsModule } from '../src/public-stats/public-stats.module';
import { SetupModule } from '../src/setup/setup.module';

export const TEST_USER_ID = 'test-user-001';
export const TEST_API_KEY = 'test-api-key-001';
export const TEST_TENANT_ID = 'test-tenant-001';
export const TEST_AGENT_ID = 'test-agent-001';
export const TEST_OTLP_KEY = 'mnfst_test-otlp-key-001';

const entities = [AgentMessage, LlmCall, ToolExecution, AgentLog, ApiKey, Tenant, Agent, AgentApiKey, NotificationRule, NotificationLog, UserProvider, TierAssignment, CustomProvider, EmailProviderConfig, SpecificityAssignment, HeaderTier, InstallMetadata];
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_MODELS_FIXTURE = {
  data: [
    {
      id: 'openai/gpt-4o',
      name: 'OpenAI: GPT-4o',
      context_length: 128000,
      architecture: {
        input_modalities: ['text'],
        output_modalities: ['text'],
      },
      pricing: {
        prompt: '0.0000025',
        completion: '0.00001',
      },
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'OpenAI: GPT-4o Mini',
      context_length: 128000,
      architecture: {
        input_modalities: ['text'],
        output_modalities: ['text'],
      },
      pricing: {
        prompt: '0.00000015',
        completion: '0.0000006',
      },
    },
    {
      id: 'anthropic/claude-opus-4-6',
      name: 'Anthropic: Claude Opus 4.6',
      context_length: 200000,
      architecture: {
        input_modalities: ['text'],
        output_modalities: ['text'],
      },
      pricing: {
        prompt: '0.000015',
        completion: '0.000075',
      },
    },
    {
      id: 'z-ai/glm-5',
      name: 'Z.ai: GLM-5',
      context_length: 128000,
      architecture: {
        input_modalities: ['text'],
        output_modalities: ['text'],
      },
      pricing: {
        prompt: '0.000002',
        completion: '0.000008',
      },
    },
  ],
} as const;

function buildTypeOrmConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres' as const,
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://myuser:mypassword@localhost:5432/mydatabase',
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
  const restoreFetch = stubOpenRouterPricingFetch();

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
        CacheModule.register({ isGlobal: true, ttl: 5000 }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        TypeOrmModule.forRoot(buildTypeOrmConfig()),
        TypeOrmModule.forFeature(entities),
        CommonModule,
        HealthModule,
        AnalyticsModule,
        OtlpModule,
        NotificationsModule,
        ModelPricesModule,
        RoutingModule,
        PublicStatsModule,
        SetupModule,
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
      }),
    );
    await app.init();

    const ds = app.get(DataSource);
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    // Seed test API key (hashed)
    await ds.query(
      `INSERT INTO api_keys (id, key, key_hash, key_prefix, user_id, name, created_at) VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
      ['test-key-id', hashKey(TEST_API_KEY), keyPrefix(TEST_API_KEY), TEST_USER_ID, 'Test Key', now],
    );

    // Seed test tenant, agent, and OTLP key (hashed)
    await ds.query(
      `INSERT INTO tenants (id, name, organization_name, is_active, created_at, updated_at) VALUES ($1,$2,$3,true,$4,$5)`,
      [TEST_TENANT_ID, TEST_USER_ID, 'Test Org', now, now],
    );
    await ds.query(
      `INSERT INTO agents (id, name, display_name, description, is_active, complexity_routing_enabled, tenant_id, created_at, updated_at) VALUES ($1,$2,$3,$4,true,true,$5,$6,$7)`,
      [TEST_AGENT_ID, 'test-agent', 'Test Agent', 'Test agent', TEST_TENANT_ID, now, now],
    );
    await ds.query(
      `INSERT INTO agent_api_keys (id, key, key_hash, key_prefix, label, tenant_id, agent_id, is_active, created_at) VALUES ($1, NULL, $2, $3, $4, $5, $6, true, $7)`,
      ['test-otlp-key-id', hashKey(TEST_OTLP_KEY), keyPrefix(TEST_OTLP_KEY), 'Test OTLP Key', TEST_TENANT_ID, TEST_AGENT_ID, now],
    );

    // Reload pricing cache from deterministic fixture data to keep e2e startup fast.
    const pricingCache = app.get(ModelPricingCacheService);
    await pricingCache.reload();

    return app;
  } finally {
    restoreFetch();
  }
}

function stubOpenRouterPricingFetch(): () => void {
  const originalFetch = global.fetch;

  global.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const url = getFetchUrl(input);
    if (url === OPENROUTER_MODELS_URL) {
      return new Response(JSON.stringify(OPENROUTER_MODELS_FIXTURE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  return () => {
    global.fetch = originalFetch;
  };
}

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}
