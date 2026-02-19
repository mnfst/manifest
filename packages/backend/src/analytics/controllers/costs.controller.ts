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
export class CostsController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
  ) {}

  @Get('costs')
  async getCosts(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '7d';
    const agentName = query.agent_name;

    const [costSummary, daily, hourly, byModel] = await Promise.all([
      this.aggregation.getCostSummary(range, user.id, agentName),
      this.timeseries.getDailyCosts(range, user.id, agentName),
      this.timeseries.getHourlyCosts(range, user.id, agentName),
      this.timeseries.getCostByModel(range, user.id, agentName),
    ]);

    return {
      summary: { weekly_cost: costSummary },
      daily,
      hourly,
      by_model: byModel,
    };
  }
}
