import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { AgentAnalyticsService } from '../services/agent-analytics.service';
import { RangeQueryDto } from '../../common/dto/range-query.dto';
import { AgentCacheInterceptor } from '../../common/interceptors/agent-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';

interface AuthenticatedRequest extends Request {
  ingestionContext: IngestionContext;
}

@Controller('api/v1/agent')
@Public()
@UseGuards(OtlpAuthGuard)
@UseInterceptors(AgentCacheInterceptor)
@CacheTTL(DASHBOARD_CACHE_TTL_MS)
export class AgentAnalyticsController {
  constructor(private readonly analytics: AgentAnalyticsService) {}

  @Get('usage')
  async getUsage(@Query() query: RangeQueryDto, @Req() req: AuthenticatedRequest) {
    const range = query.range ?? '24h';
    const ctx = req.ingestionContext;
    const usage = await this.analytics.getUsage(range, ctx);
    return {
      ...usage,
      agentName: ctx.agentName,
    };
  }

  @Get('costs')
  async getCosts(@Query() query: RangeQueryDto, @Req() req: AuthenticatedRequest) {
    const range = query.range ?? '7d';
    const ctx = req.ingestionContext;
    return this.analytics.getCosts(range, ctx);
  }
}
