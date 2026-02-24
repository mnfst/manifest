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
import { DatabaseSeederService } from './database-seeder.service';
import { LocalBootstrapService } from './local-bootstrap.service';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { InitialSchema1771464895790 } from './migrations/1771464895790-InitialSchema';
import { HashApiKeys1771500000000 } from './migrations/1771500000000-HashApiKeys';
import { ModelPricingImprovements1771600000000 } from './migrations/1771600000000-ModelPricingImprovements';
import { EmailProviderConfigs1771700000000 } from './migrations/1771700000000-EmailProviderConfigs';

const entities = [
  AgentMessage, LlmCall, ToolExecution, SecurityEvent, ModelPricing,
  ModelPricingHistory, UnresolvedModel,
  TokenUsageSnapshot, CostSnapshot, AgentLog,
  ApiKey, Tenant, Agent, AgentApiKey,
  NotificationRule, NotificationLog,
  EmailProviderConfig,
];

const migrations = [
  InitialSchema1771464895790,
  HashApiKeys1771500000000,
  ModelPricingImprovements1771600000000,
  EmailProviderConfigs1771700000000,
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
          const dbPath = config.get<string>('app.sqlitePath') || ':memory:';
          return {
            type: 'better-sqlite3' as const,
            database: dbPath,
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
          migrationsRun: true,
          migrationsTransactionMode: 'all' as const,
          migrations,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature([Tenant, Agent, AgentApiKey, ApiKey, ModelPricing, SecurityEvent]),
    ModelPricesModule,
  ],
  providers: buildModeServices(),
  exports: buildModeServices(),
})
export class DatabaseModule {}
