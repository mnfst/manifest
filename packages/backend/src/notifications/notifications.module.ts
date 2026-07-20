import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationRulesService } from './services/notification-rules.service';
import { NotificationCronService } from './services/notification-cron.service';
import { NotificationEmailService } from './services/notification-email.service';
import { EmailProviderConfigService } from './services/email-provider-config.service';
import { NotificationLogService } from './services/notification-log.service';
import { LimitCheckService } from './services/limit-check.service';
import { NotificationRule } from '../entities/notification-rule.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationRule, NotificationLog, AgentMessage, Agent, Tenant]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationRulesService,
    NotificationCronService,
    NotificationEmailService,
    EmailProviderConfigService,
    NotificationLogService,
    LimitCheckService,
  ],
  exports: [LimitCheckService],
})
export class NotificationsModule {}
