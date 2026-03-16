import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { RangeQueryDto } from '../../common/dto/range-query.dto';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';
import { computeTrend } from '../services/query-helpers';

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

    const [hourly, daily, prevTokens] = await Promise.all([
      this.timeseries.getHourlyTokens(range, user.id, agentName),
      this.timeseries.getDailyTokens(range, user.id, agentName),
      this.aggregation.getPreviousTokenTotal(range, user.id, agentName),
    ]);

    // Derive summary from hourly timeseries data (avoids separate aggregation query)
    const inputTotal = hourly.reduce((s, h) => s + h.input_tokens, 0);
    const outputTotal = hourly.reduce((s, h) => s + h.output_tokens, 0);
    const current = inputTotal + outputTotal;

    return {
      summary: {
        total_tokens: {
          value: current,
          trend_pct: computeTrend(current, prevTokens),
          sub_values: { input: inputTotal, output: outputTotal },
        },
        input_tokens: inputTotal,
        output_tokens: outputTotal,
      },
      hourly,
      daily,
    };
  }
}
