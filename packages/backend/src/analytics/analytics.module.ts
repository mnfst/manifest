import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { LlmCall } from '../entities/llm-call.entity';
import { ToolExecution } from '../entities/tool-execution.entity';
import { AgentLog } from '../entities/agent-log.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../entities/specificity-assignment.entity';
import { HeaderTier } from '../entities/header-tier.entity';
import { OtlpModule } from '../otlp/otlp.module';
import { RoutingCoreModule } from '../routing/routing-core/routing-core.module';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { AggregationService } from './services/aggregation.service';
import { AgentDuplicationService } from './services/agent-duplication.service';
import { AgentLifecycleService } from './services/agent-lifecycle.service';
import { TimeseriesQueriesService } from './services/timeseries-queries.service';
import { MessagesQueryService } from './services/messages-query.service';
import { MessageDetailsService } from './services/message-details.service';
import { MessageFeedbackService } from './services/message-feedback.service';
import { SpecificityFeedbackService } from './services/specificity-feedback.service';
import { AgentAnalyticsService } from './services/agent-analytics.service';
import { OverviewController } from './controllers/overview.controller';
import { TokensController } from './controllers/tokens.controller';
import { CostsController } from './controllers/costs.controller';
import { MessagesController } from './controllers/messages.controller';
import { AgentsController } from './controllers/agents.controller';
import { AgentAnalyticsController } from './controllers/agent-analytics.controller';
import { SavingsController } from './controllers/savings.controller';
import { SavingsQueryService } from './services/savings-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentMessage,
      Agent,
      Tenant,
      LlmCall,
      ToolExecution,
      AgentLog,
      CustomProvider,
      UserProvider,
      TierAssignment,
      SpecificityAssignment,
      HeaderTier,
    ]),
    OtlpModule,
    RoutingCoreModule,
    ModelPricesModule,
  ],
  controllers: [
    OverviewController,
    TokensController,
    CostsController,
    MessagesController,
    AgentsController,
    AgentAnalyticsController,
    SavingsController,
  ],
  providers: [
    AggregationService,
    AgentDuplicationService,
    AgentLifecycleService,
    TimeseriesQueriesService,
    MessagesQueryService,
    MessageDetailsService,
    MessageFeedbackService,
    SpecificityFeedbackService,
    AgentAnalyticsService,
    SavingsQueryService,
  ],
  exports: [SpecificityFeedbackService],
})
export class AnalyticsModule {}
