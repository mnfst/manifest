import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentMessage } from '../entities/agent-message.entity';
import { LlmCall } from '../entities/llm-call.entity';
import { ToolExecution } from '../entities/tool-execution.entity';
import { SecurityEvent } from '../entities/security-event.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { TokenUsageSnapshot } from '../entities/token-usage-snapshot.entity';
import { CostSnapshot } from '../entities/cost-snapshot.entity';
import { AgentLog } from '../entities/agent-log.entity';
import { ApiKey } from '../entities/api-key.entity';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { NotificationRule } from '../entities/notification-rule.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { DatabaseSeederService } from './database-seeder.service';
import { PricingSyncService } from './pricing-sync.service';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { InitialSchema1771464895790 } from './migrations/1771464895790-InitialSchema';
import { HashApiKeys1771500000000 } from './migrations/1771500000000-HashApiKeys';

const entities = [
  AgentMessage, LlmCall, ToolExecution, SecurityEvent, ModelPricing,
  TokenUsageSnapshot, CostSnapshot, AgentLog,
  ApiKey, Tenant, Agent, AgentApiKey,
  NotificationRule, NotificationLog,
];

const migrations = [InitialSchema1771464895790, HashApiKeys1771500000000];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('app.databaseUrl'),
        entities,
        synchronize: false,
        migrationsRun: true,
        migrationsTransactionMode: 'all' as const,
        migrations,
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([Tenant, Agent, AgentApiKey, ApiKey, ModelPricing, SecurityEvent]),
    ModelPricesModule,
  ],
  providers: [DatabaseSeederService, PricingSyncService],
  exports: [DatabaseSeederService, PricingSyncService],
})
export class DatabaseModule {}
