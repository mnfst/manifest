import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { EmailConfigService } from './services/email-config.service';
import { NotificationEmailAddressService } from './services/notification-email-address.service';
import { SaveEmailConfigDto, TestEmailDto } from './dto/email-config.dto';
import { SaveNotificationEmailDto } from './dto/notification-email.dto';

@Controller('api/v1/email-config')
export class EmailConfigController {
  constructor(
    private readonly emailConfigService: EmailConfigService,
    private readonly notificationEmailService: NotificationEmailAddressService,
  ) {}

  @Get()
  getConfig() {
    return this.emailConfigService.getConfig();
  }

  @Post()
  saveConfig(@Body() dto: SaveEmailConfigDto) {
    this.emailConfigService.saveConfig(dto);
    return { saved: true };
  }

  @Post('test')
  async testConfig(@Body() dto: TestEmailDto) {
    return this.emailConfigService.testConfig(dto, dto.to);
  }

  @Delete()
  clearConfig() {
    this.emailConfigService.clearConfig();
    return { cleared: true };
  }

  @Get('notification-email')
  getNotificationEmail() {
    return this.notificationEmailService.getNotificationEmail();
  }

  @Post('notification-email')
  saveNotificationEmail(@Body() dto: SaveNotificationEmailDto) {
    this.notificationEmailService.saveNotificationEmail(dto.email);
    return { saved: true };
  }
}
