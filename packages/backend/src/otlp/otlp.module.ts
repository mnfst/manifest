import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { LlmCall } from '../entities/llm-call.entity';
import { ToolExecution } from '../entities/tool-execution.entity';
import { TokenUsageSnapshot } from '../entities/token-usage-snapshot.entity';
import { CostSnapshot } from '../entities/cost-snapshot.entity';
import { AgentLog } from '../entities/agent-log.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { OtlpController } from './otlp.controller';
import { OtlpDecoderService } from './services/otlp-decoder.service';
import { TraceIngestService } from './services/trace-ingest.service';
import { TraceDedupService } from './services/trace-dedup.service';
import { TraceCostCalculator } from './services/trace-cost-calculator';
import { TraceEntityBuilder } from './services/trace-entity-builder';
import { MetricIngestService } from './services/metric-ingest.service';
import { LogIngestService } from './services/log-ingest.service';
import { ApiKeyGeneratorService } from './services/api-key.service';
import { OtlpAuthGuard } from './guards/otlp-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentApiKey,
      Agent,
      Tenant,
      AgentMessage,
      LlmCall,
      ToolExecution,
      TokenUsageSnapshot,
      CostSnapshot,
      AgentLog,
      UserProvider,
    ]),
    ModelPricesModule,
  ],
  controllers: [OtlpController],
  providers: [
    OtlpDecoderService,
    TraceIngestService,
    TraceDedupService,
    TraceCostCalculator,
    TraceEntityBuilder,
    MetricIngestService,
    LogIngestService,
    ApiKeyGeneratorService,
    OtlpAuthGuard,
  ],
  exports: [ApiKeyGeneratorService, OtlpAuthGuard, TypeOrmModule],
})
export class OtlpModule {}
