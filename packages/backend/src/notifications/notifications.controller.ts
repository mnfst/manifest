import { Controller, Get, Post, Patch, Delete, Query, Param, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { NotificationRulesService } from './services/notification-rules.service';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from './dto/notification-rule.dto';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly rulesService: NotificationRulesService) {}

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
