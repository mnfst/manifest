import { Controller, Get, Post, Patch, Delete, Query, Param, Body, Logger } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { NotificationRulesService } from './services/notification-rules.service';
import { EmailProviderConfigService } from './services/email-provider-config.service';
import { NotificationCronService } from './services/notification-cron.service';
import { LimitCheckService } from './services/limit-check.service';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from './dto/notification-rule.dto';
import { SetEmailProviderDto, TestEmailProviderDto } from './dto/set-email-provider.dto';

@Controller('api/v1/notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly rulesService: NotificationRulesService,
    private readonly emailProviderConfigService: EmailProviderConfigService,
    private readonly cronService: NotificationCronService,
    private readonly limitCheck: LimitCheckService,
  ) {}

  @Get('email-provider')
  async getEmailProvider(@CurrentUser() user: AuthUser) {
    const config = await this.emailProviderConfigService.getConfig(user.id);
    return config ?? { configured: false };
  }

  @Post('email-provider/test')
  async testEmailProvider(
    @CurrentUser() user: AuthUser,
    @Body() body: TestEmailProviderDto,
  ) {
    return this.emailProviderConfigService.testConfig(
      { provider: body.provider, apiKey: body.apiKey, domain: body.domain },
      body.to,
    );
  }

  @Post('email-provider/test-saved')
  async testSavedEmailProvider(
    @CurrentUser() user: AuthUser,
    @Body() body: { to: string },
  ) {
    return this.emailProviderConfigService.testSavedConfig(user.id, body.to);
  }

  @Post('email-provider')
  async setEmailProvider(
    @CurrentUser() user: AuthUser,
    @Body() body: SetEmailProviderDto,
  ) {
    return this.emailProviderConfigService.upsert(user.id, body);
  }

  @Delete('email-provider')
  async removeEmailProvider(@CurrentUser() user: AuthUser) {
    await this.emailProviderConfigService.remove(user.id);
    return { ok: true };
  }

  @Get('notification-email')
  async getNotificationEmail(@CurrentUser() user: AuthUser) {
    const email = await this.emailProviderConfigService.getNotificationEmail(user.id);
    return { email };
  }

  @Post('notification-email')
  async setNotificationEmail(
    @CurrentUser() user: AuthUser,
    @Body() body: { email: string },
  ) {
    await this.emailProviderConfigService.setNotificationEmail(user.id, body.email);
    return { saved: true };
  }

  @Post('trigger-check')
  async triggerCheck() {
    this.logger.log('Manual notification check triggered');
    const triggered = await this.cronService.checkThresholds();
    return { triggered, message: `${triggered} notification(s) triggered` };
  }

  @Get()
  async listRules(
    @Query('agent_name') agentName: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rulesService.listRules(user.id, agentName);
  }

  @Post()
  async createRule(
    @Body() dto: CreateNotificationRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const rule = await this.rulesService.createRule(user.id, dto);
    if (rule.action === 'block' || rule.action === 'both') {
      this.limitCheck.invalidateCache(rule.tenant_id, rule.agent_name);
    }
    return rule;
  }

  @Patch(':id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const rule = await this.rulesService.updateRule(user.id, id, dto);
    this.limitCheck.invalidateCache(rule.tenant_id, rule.agent_name);
    return rule;
  }

  @Delete(':id')
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const rule = await this.rulesService.getRule(id);
    await this.rulesService.deleteRule(user.id, id);
    if (rule) {
      this.limitCheck.invalidateCache(rule.tenant_id, rule.agent_name);
    }
    return { deleted: true };
  }
}
