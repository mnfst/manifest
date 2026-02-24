import { Controller, Get, Post, Patch, Delete, Query, Param, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { NotificationRulesService } from './services/notification-rules.service';
import { EmailProviderConfigService } from './services/email-provider-config.service';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from './dto/notification-rule.dto';
import { SetEmailProviderDto, TestEmailProviderDto } from './dto/set-email-provider.dto';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(
    private readonly rulesService: NotificationRulesService,
    private readonly emailProviderConfigService: EmailProviderConfigService,
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
    return this.rulesService.createRule(user.id, dto);
  }

  @Patch(':id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rulesService.updateRule(user.id, id, dto);
  }

  @Delete(':id')
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.rulesService.deleteRule(user.id, id);
    return { deleted: true };
  }
}
