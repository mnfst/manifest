import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppEntity } from './app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowModule } from '../flow/flow.module';
import { NodeModule } from '../node/node.module';
import { McpModule } from '../mcp/mcp.module';
import { FlowExecutionModule } from '../flow-execution/flow-execution.module';
import { SeedModule } from '../seed/seed.module';
import { ChatModule } from '../chat/chat.module';
import { AuthModule, AuthGuard, UserAppRoleEntity, PendingInvitationEntity } from '../auth';
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
      entities: [AppEntity, FlowEntity, FlowExecutionEntity, UserAppRoleEntity, PendingInvitationEntity],
      synchronize: true, // POC only - use migrations in production
    }),
    TypeOrmModule.forFeature([AppEntity, UserAppRoleEntity]),
    AuthModule,
    FlowModule,
    NodeModule,
    McpModule,
    FlowExecutionModule,
    SeedModule,
    ChatModule,
    EmailModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply AuthGuard globally - use @Public() to exempt routes
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AppService],
})
export class AppModule {}
