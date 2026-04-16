import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesQueryDto } from '../dto/messages-query.dto';
import { MessageFeedbackDto } from '../dto/message-feedback.dto';
import { MessagesQueryService } from '../services/messages-query.service';
import { MessageDetailsService } from '../services/message-details.service';
import { MessageFeedbackService } from '../services/message-feedback.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';

@Controller('api/v1')
export class MessagesController {
  constructor(
    private readonly messagesQuery: MessagesQueryService,
    private readonly messageDetails: MessageDetailsService,
    private readonly messageFeedback: MessageFeedbackService,
  ) {}

  @Get('messages')
  async getMessages(@Query() query: MessagesQueryDto, @CurrentUser() user: AuthUser) {
    return this.messagesQuery.getMessages({
      range: query.range,
      userId: user.id,
      provider: query.provider,
      service_type: query.service_type,
      cost_min: query.cost_min,
      cost_max: query.cost_max,
      limit: Math.min(query.limit ?? 50, 200),
      cursor: query.cursor,
      agent_name: query.agent_name,
    });
  }

  @Get('messages/:id/details')
  async getMessageDetails(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.messageDetails.getDetails(id, user.id);
  }

  @Patch('messages/:id/feedback')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setFeedback(
    @Param('id') id: string,
    @Body() body: MessageFeedbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.messageFeedback.setFeedback(id, user.id, body.rating, body.tags, body.details);
  }

  @Delete('messages/:id/feedback')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearFeedback(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.messageFeedback.clearFeedback(id, user.id);
  }
}
