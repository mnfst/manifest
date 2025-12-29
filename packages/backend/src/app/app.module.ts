import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppEntity } from './app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ViewEntity } from '../view/view.entity';
import { MockDataEntity } from '../mock-data/mock-data.entity';
import { ConnectorEntity } from '../connector/connector.entity';
import { ReturnValueEntity } from '../return-value/return-value.entity';
import { CallFlowEntity } from '../call-flow/call-flow.entity';
import { ActionConnectionEntity } from '../action-connection/action-connection.entity';
import { FlowModule } from '../flow/flow.module';
import { ViewModule } from '../view/view.module';
import { AgentModule } from '../agent/agent.module';
import { McpModule } from '../mcp/mcp.module';
import { MockDataModule } from '../mock-data/mock-data.module';
import { ConnectorModule } from '../connector/connector.module';
import { ReturnValueModule } from '../return-value/return-value.module';
import { CallFlowModule } from '../call-flow/call-flow.module';
import { ActionConnectionModule } from '../action-connection/action-connection.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: './data/app.db',
      entities: [AppEntity, FlowEntity, ViewEntity, MockDataEntity, ConnectorEntity, ReturnValueEntity, CallFlowEntity, ActionConnectionEntity],
      synchronize: true, // POC only - use migrations in production
    }),
    TypeOrmModule.forFeature([AppEntity]),
    FlowModule,
    ViewModule,
    AgentModule,
    McpModule,
    MockDataModule,
    ConnectorModule,
    ReturnValueModule,
    CallFlowModule,
    ActionConnectionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
