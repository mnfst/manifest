import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppEntity } from './app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ConnectorEntity } from '../connector/connector.entity';
import { FlowModule } from '../flow/flow.module';
import { NodeModule } from '../node/node.module';
import { AgentModule } from '../agent/agent.module';
import { McpModule } from '../mcp/mcp.module';
import { ConnectorModule } from '../connector/connector.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: './data/app.db',
      entities: [AppEntity, FlowEntity, ConnectorEntity],
      synchronize: true, // POC only - use migrations in production
    }),
    TypeOrmModule.forFeature([AppEntity]),
    FlowModule,
    NodeModule,
    AgentModule,
    McpModule,
    ConnectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
