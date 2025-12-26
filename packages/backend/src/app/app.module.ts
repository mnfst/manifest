import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppEntity } from '../entities/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ViewEntity } from '../view/view.entity';
import { FlowModule } from '../flow/flow.module';
import { ViewModule } from '../view/view.module';
import { AgentModule } from '../agent/agent.module';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: './data/app.db',
      entities: [AppEntity, FlowEntity, ViewEntity],
      synchronize: true, // POC only - use migrations in production
    }),
    TypeOrmModule.forFeature([AppEntity]),
    FlowModule,
    ViewModule,
    AgentModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
