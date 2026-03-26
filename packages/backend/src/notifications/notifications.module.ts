import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationRulesService } from './services/notification-rules.service';
import { NotificationCronService } from './services/notification-cron.service';
import { NotificationEmailService } from './services/notification-email.service';
import { EmailProviderConfigService } from './services/email-provider-config.service';
import { LimitCheckService } from './services/limit-check.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationRulesService,
    NotificationCronService,
    NotificationEmailService,
    EmailProviderConfigService,
    LimitCheckService,
  ],
  exports: [LimitCheckService],
})
export class NotificationsModule {}
