import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { EmailConfigController } from './email-config.controller';
import { NotificationRulesService } from './services/notification-rules.service';
import { NotificationCronService } from './services/notification-cron.service';
import { NotificationEmailService } from './services/notification-email.service';
import { EmailConfigService } from './services/email-config.service';
import { NotificationEmailAddressService } from './services/notification-email-address.service';
import { EmailProviderConfigService } from './services/email-provider-config.service';

@Module({
  controllers: [NotificationsController, EmailConfigController],
  providers: [
    NotificationRulesService,
    NotificationCronService,
    NotificationEmailService,
    EmailConfigService,
    NotificationEmailAddressService,
    EmailProviderConfigService,
  ],
})
export class NotificationsModule {}
