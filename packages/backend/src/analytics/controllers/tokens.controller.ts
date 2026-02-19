import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { RangeQueryDto } from '../../common/dto/range-query.dto';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';

@Controller('api/v1')
@UseInterceptors(UserCacheInterceptor)
@CacheTTL(DASHBOARD_CACHE_TTL_MS)
export class TokensController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
  ) {}

  @Get('tokens')
  async getTokens(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '24h';
    const agentName = query.agent_name;

    const [tokenSummary, hourly, daily] = await Promise.all([
      this.aggregation.getTokenSummary(range, user.id, agentName),
      this.timeseries.getHourlyTokens(range, user.id, agentName),
      this.timeseries.getDailyTokens(range, user.id, agentName),
    ]);

    return {
      summary: {
        total_tokens: tokenSummary.tokens_today,
        input_tokens: tokenSummary.input_tokens,
        output_tokens: tokenSummary.output_tokens,
      },
      hourly,
      daily,
    };
  }
}
