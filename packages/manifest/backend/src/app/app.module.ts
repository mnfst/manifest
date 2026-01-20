import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { EmailVerificationTokenEntity } from '../auth/entities/email-verification-token.entity';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SecretModule } from '../secret/secret.module';
import { AppSecretEntity } from '../secret/secret.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting: 100 requests per minute per IP (global)
    // Use @SkipThrottle() to exempt specific routes
    // Use @Throttle({ default: { limit: 5, ttl: 60000 } }) for stricter limits on auth routes
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,   // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 10000,  // 10 seconds
        limit: 50,   // 50 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000,  // 1 minute
        limit: 100,  // 100 requests per minute
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: './data/app.db',
      entities: [AppEntity, FlowEntity, FlowExecutionEntity, UserAppRoleEntity, PendingInvitationEntity, EmailVerificationTokenEntity, AppSecretEntity],
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
    SecretModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply AuthGuard globally - use @Public() to exempt routes
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // Apply rate limiting globally - use @SkipThrottle() to exempt routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AppService],
})
export class AppModule {}
