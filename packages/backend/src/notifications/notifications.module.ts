import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationRulesService } from './services/notification-rules.service';
import { NotificationCronService } from './services/notification-cron.service';
import { NotificationEmailService } from './services/notification-email.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationRulesService, NotificationCronService, NotificationEmailService],
})
export class NotificationsModule {}
