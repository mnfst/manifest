import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { AgentAnalyticsService } from '../services/agent-analytics.service';
import { RangeQueryDto } from '../../common/dto/range-query.dto';

interface AuthenticatedRequest extends Request {
  ingestionContext: IngestionContext;
}

@Controller('api/v1/agent')
@Public()
@UseGuards(OtlpAuthGuard)
export class AgentAnalyticsController {
  constructor(private readonly analytics: AgentAnalyticsService) {}

  @Get('usage')
  async getUsage(
    @Query() query: RangeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const range = query.range ?? '24h';
    const ctx = req.ingestionContext;
    return this.analytics.getUsage(range, ctx);
  }

  @Get('costs')
  async getCosts(
    @Query() query: RangeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const range = query.range ?? '7d';
    const ctx = req.ingestionContext;
    return this.analytics.getCosts(range, ctx);
  }
}
