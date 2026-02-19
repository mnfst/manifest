import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { RangeQueryDto } from '../../common/dto/range-query.dto';
import { isHourlyRange } from '../../common/utils/range.util';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';

@Controller('api/v1')
@UseInterceptors(UserCacheInterceptor)
@CacheTTL(DASHBOARD_CACHE_TTL_MS)
export class OverviewController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '24h';
    const agentName = query.agent_name;
    const hourly = isHourlyRange(range);

    const [
      tokenSummary, costSummary, messages, costByModel, recentActivity,
      hourlyTokens, dailyTokens, hourlyCosts, dailyCosts,
      hourlyMessages, dailyMessages, activeSkills, hasData,
    ] = await Promise.all([
      this.aggregation.getTokenSummary(range, user.id, agentName),
      this.aggregation.getCostSummary(range, user.id, agentName),
      this.aggregation.getMessageCount(range, user.id, agentName),
      this.timeseries.getCostByModel(range, user.id, agentName),
      this.timeseries.getRecentActivity(range, user.id, 5, agentName),
      hourly ? this.timeseries.getHourlyTokens(range, user.id, agentName) : Promise.resolve([]),
      hourly ? Promise.resolve([]) : this.timeseries.getDailyTokens(range, user.id, agentName),
      hourly ? this.timeseries.getHourlyCosts(range, user.id, agentName) : Promise.resolve([]),
      hourly ? Promise.resolve([]) : this.timeseries.getDailyCosts(range, user.id, agentName),
      hourly ? this.timeseries.getHourlyMessages(range, user.id, agentName) : Promise.resolve([]),
      hourly ? Promise.resolve([]) : this.timeseries.getDailyMessages(range, user.id, agentName),
      this.timeseries.getActiveSkills(range, user.id, agentName),
      this.aggregation.hasAnyData(user.id, agentName),
    ]);

    return {
      summary: {
        tokens_today: tokenSummary.tokens_today,
        cost_today: costSummary,
        messages,
        // TODO: implement real service health tracking
        services_hit: { total: 0, healthy: 0, issues: 0 },
      },
      token_usage: hourly ? hourlyTokens : dailyTokens,
      cost_usage: hourly ? hourlyCosts : dailyCosts,
      message_usage: hourly ? hourlyMessages : dailyMessages,
      cost_by_model: costByModel,
      recent_activity: recentActivity,
      active_skills: activeSkills,
      has_data: hasData,
    };
  }
}
