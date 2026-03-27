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
export class CostsController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
  ) {}

  @Get('costs')
  async getCosts(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '7d';
    const agentName = query.agent_name;

    const [{ costUsage: hourly }, { costUsage: daily }, byModel, prevCost] = await Promise.all([
      this.timeseries.getTimeseries(range, user.id, true, undefined, agentName),
      this.timeseries.getTimeseries(range, user.id, false, undefined, agentName),
      this.timeseries.getCostByModel(range, user.id, agentName),
      this.aggregation.getPreviousCostTotal(range, user.id, agentName),
    ]);

    // Derive cost summary from hourly timeseries data (avoids separate aggregation query)
    const currentCost = hourly.reduce((s, h) => s + h.cost, 0);

    return {
      summary: {
        weekly_cost: {
          value: currentCost,
          trend_pct: computeTrend(currentCost, prevCost),
        },
      },
      daily,
      hourly,
      by_model: byModel,
    };
  }
}
