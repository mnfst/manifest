import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { OtlpModule } from '../otlp/otlp.module';
import { AggregationService } from './services/aggregation.service';
import { TimeseriesQueriesService } from './services/timeseries-queries.service';
import { MessagesQueryService } from './services/messages-query.service';
import { AgentAnalyticsService } from './services/agent-analytics.service';
import { OverviewController } from './controllers/overview.controller';
import { TokensController } from './controllers/tokens.controller';
import { CostsController } from './controllers/costs.controller';
import { MessagesController } from './controllers/messages.controller';
import { AgentsController } from './controllers/agents.controller';
import { AgentAnalyticsController } from './controllers/agent-analytics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgentMessage, Agent, Tenant]), OtlpModule],
  controllers: [
    OverviewController,
    TokensController,
    CostsController,
    MessagesController,
    AgentsController,
    AgentAnalyticsController,
  ],
  providers: [
    AggregationService,
    TimeseriesQueriesService,
    MessagesQueryService,
    AgentAnalyticsService,
  ],
})
export class AnalyticsModule {}
