import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentMessage } from '../entities/agent-message.entity';
import { LlmCall } from '../entities/llm-call.entity';
import { ToolExecution } from '../entities/tool-execution.entity';
import { SecurityEvent } from '../entities/security-event.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingHistory } from '../entities/model-pricing-history.entity';
import { UnresolvedModel } from '../entities/unresolved-model.entity';
import { TokenUsageSnapshot } from '../entities/token-usage-snapshot.entity';
import { CostSnapshot } from '../entities/cost-snapshot.entity';
import { AgentLog } from '../entities/agent-log.entity';
import { ApiKey } from '../entities/api-key.entity';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { NotificationRule } from '../entities/notification-rule.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { EmailProviderConfig } from '../entities/email-provider-config.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { DatabaseSeederService } from './database-seeder.service';
import { LocalBootstrapService } from './local-bootstrap.service';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { InitialSchema1771464895790 } from './migrations/1771464895790-InitialSchema';
import { HashApiKeys1771500000000 } from './migrations/1771500000000-HashApiKeys';
import { ModelPricingImprovements1771600000000 } from './migrations/1771600000000-ModelPricingImprovements';
import { EmailProviderConfigs1771700000000 } from './migrations/1771700000000-EmailProviderConfigs';
import { AddNotificationEmailAndOptionalDomain1771800000000 } from './migrations/1771800000000-AddNotificationEmailAndOptionalDomain';
import { AddModelCapabilities1771600000000 } from './migrations/1771600000000-AddModelCapabilities';
import { AddRoutingTables1771700000000 } from './migrations/1771700000000-AddRoutingTables';
import { AddQualityScore1771800000000 } from './migrations/1771800000000-AddQualityScore';
import { SeedQualityScores1771800100000 } from './migrations/1771800100000-SeedQualityScores';
import { EncryptApiKeys1771900000000 } from './migrations/1771900000000-EncryptApiKeys';
import { MakeApiKeyNullable1772000000000 } from './migrations/1772000000000-MakeApiKeyNullable';
import { AddRoutingTier1772100000000 } from './migrations/1772100000000-AddRoutingTier';
import { AddLimitAction1772200000000 } from './migrations/1772200000000-AddLimitAction';
import { AddRoutingReason1772300000000 } from './migrations/1772300000000-AddRoutingReason';
import { AddAgentDisplayName1772400000000 } from './migrations/1772400000000-AddAgentDisplayName';
import { PerAgentRouting1772500000000 } from './migrations/1772500000000-PerAgentRouting';
import { AddCustomProviders1772668898071 } from './migrations/1772668898071-AddCustomProviders';
import { NullablePricing1772682112419 } from './migrations/1772682112419-NullablePricing';
import { AddPerformanceIndexes1772843035514 } from './migrations/1772843035514-AddPerformanceIndexes';
import { AddDashboardIndexes1772905146384 } from './migrations/1772905146384-AddDashboardIndexes';
import { AddFallbacks1772905260464 } from './migrations/1772905260464-AddFallbacks';
import { AddModelDisplayName1772920000000 } from './migrations/1772920000000-AddModelDisplayName';
import { DropRedundantIndexes1772940000000 } from './migrations/1772940000000-DropRedundantIndexes';
import { BackfillTenantId1772948502780 } from './migrations/1772948502780-BackfillTenantId';
import { DropUnusedIndexes1772960000000 } from './migrations/1772960000000-DropUnusedIndexes';

const entities = [
  AgentMessage,
  LlmCall,
  ToolExecution,
  SecurityEvent,
  ModelPricing,
  ModelPricingHistory,
  UnresolvedModel,
  TokenUsageSnapshot,
  CostSnapshot,
  AgentLog,
  ApiKey,
  Tenant,
  Agent,
  AgentApiKey,
  NotificationRule,
  NotificationLog,
  EmailProviderConfig,
  UserProvider,
  TierAssignment,
  CustomProvider,
];

// Migration execution order is determined by array order below.
// Three timestamp pairs collide (1771600000000, 1771700000000, 1771800000000)
// but cannot be renamed since they are already applied in production databases.
// Future migrations MUST use unique timestamps (e.g. Date.now()).
const migrations = [
  InitialSchema1771464895790,
  HashApiKeys1771500000000,
  ModelPricingImprovements1771600000000,
  EmailProviderConfigs1771700000000,
  AddNotificationEmailAndOptionalDomain1771800000000,
  AddModelCapabilities1771600000000,
  AddRoutingTables1771700000000,
  AddQualityScore1771800000000,
  SeedQualityScores1771800100000,
  EncryptApiKeys1771900000000,
  MakeApiKeyNullable1772000000000,
  AddRoutingTier1772100000000,
  AddLimitAction1772200000000,
  AddRoutingReason1772300000000,
  AddAgentDisplayName1772400000000,
  PerAgentRouting1772500000000,
  AddCustomProviders1772668898071,
  NullablePricing1772682112419,
  AddPerformanceIndexes1772843035514,
  AddDashboardIndexes1772905146384,
  AddFallbacks1772905260464,
  AddModelDisplayName1772920000000,
  DropRedundantIndexes1772940000000,
  BackfillTenantId1772948502780,
  DropUnusedIndexes1772960000000,
];

const isLocalMode = process.env['MANIFEST_MODE'] === 'local';

function buildModeServices() {
  const seeder = isLocalMode ? LocalBootstrapService : DatabaseSeederService;
  return [seeder];
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (isLocalMode) {
          const dbPath = config.get<string>('app.dbPath') || ':memory:';
          return {
            type: 'sqljs' as const,
            location: dbPath === ':memory:' ? undefined : dbPath,
            autoSave: dbPath !== ':memory:',
            entities,
            synchronize: true,
            migrationsRun: false,
            logging: false,
          };
        }
        return {
          type: 'postgres' as const,
          url: config.get<string>('app.databaseUrl'),
          entities,
          synchronize: false,
          migrationsRun: config.get<string>('app.nodeEnv') !== 'production',
          migrationsTransactionMode: 'all' as const,
          migrations,
          logging: false,
          extra: {
            max: 5,
            idleTimeoutMillis: 30000,
          },
        };
      },
    }),
    TypeOrmModule.forFeature([
      Tenant,
      Agent,
      AgentApiKey,
      AgentMessage,
      ApiKey,
      ModelPricing,
      SecurityEvent,
      UserProvider,
      TierAssignment,
      CustomProvider,
    ]),
    ModelPricesModule,
  ],
  providers: buildModeServices(),
  exports: buildModeServices(),
})
export class DatabaseModule {}
