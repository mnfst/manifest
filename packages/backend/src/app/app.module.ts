import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppEntity } from './app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ConnectorEntity } from '../connector/connector.entity';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowModule } from '../flow/flow.module';
import { NodeModule } from '../node/node.module';
import { McpModule } from '../mcp/mcp.module';
import { ConnectorModule } from '../connector/connector.module';
import { FlowExecutionModule } from '../flow-execution/flow-execution.module';
import { SeedModule } from '../seed/seed.module';
import { ChatModule } from '../chat/chat.module';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: './data/app.db',
      entities: [AppEntity, FlowEntity, ConnectorEntity, FlowExecutionEntity],
      synchronize: true, // POC only - use migrations in production
    }),
    TypeOrmModule.forFeature([AppEntity]),
    FlowModule,
    NodeModule,
    McpModule,
    ConnectorModule,
    FlowExecutionModule,
    SeedModule,
    ChatModule,
    EmailModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
