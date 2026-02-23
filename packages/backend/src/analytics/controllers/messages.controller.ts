import { Controller, Get, Query } from '@nestjs/common';
import { MessagesQueryDto } from '../dto/messages-query.dto';
import { AggregationService } from '../services/aggregation.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';

@Controller('api/v1')
export class MessagesController {
  constructor(private readonly aggregation: AggregationService) {}

  @Get('messages')
  async getMessages(@Query() query: MessagesQueryDto, @CurrentUser() user: AuthUser) {
    return this.aggregation.getMessages({
      range: query.range,
      userId: user.id,
      status: query.status,
      service_type: query.service_type,
      model: query.model,
      cost_min: query.cost_min,
      cost_max: query.cost_max,
      limit: Math.min(query.limit ?? 50, 200),
      cursor: query.cursor,
      agent_name: query.agent_name,
    });
  }
}
