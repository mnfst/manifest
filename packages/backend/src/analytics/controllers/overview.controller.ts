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
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ProviderService } from '../../routing/routing-core/provider.service';
import { ResolveAgentService } from '../../routing/routing-core/resolve-agent.service';

@Controller('api/v1')
@UseInterceptors(UserCacheInterceptor)
@CacheTTL(DASHBOARD_CACHE_TTL_MS)
export class OverviewController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
    private readonly tenantCache: TenantCacheService,
    private readonly providerService: ProviderService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '24h';
    const agentName = query.agent_name;
    const hourly = isHourlyRange(range);
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;

    const [summary, tsData, costByModel, recentActivity, activeSkills, hasData, hasProviders] =
      await Promise.all([
        this.aggregation.getSummaryMetrics(range, user.id, tenantId, agentName),
        this.timeseries.getTimeseries(range, user.id, hourly, tenantId, agentName),
        this.timeseries.getCostByModel(range, user.id, agentName, tenantId),
        this.timeseries.getRecentActivity(range, user.id, 5, agentName, tenantId),
        this.timeseries.getActiveSkills(range, user.id, agentName, tenantId),
        this.aggregation.hasAnyData(user.id, agentName, tenantId),
        this.hasActiveProviders(user.id, agentName),
      ]);

    return {
      summary: {
        tokens_today: summary.tokens.tokens_today,
        cost_today: summary.cost,
        messages: summary.messages,
        services_hit: { total: 0, healthy: 0, issues: 0 },
      },
      token_usage: tsData.tokenUsage,
      cost_usage: tsData.costUsage,
      message_usage: tsData.messageUsage,
      cost_by_model: costByModel,
      recent_activity: recentActivity,
      active_skills: activeSkills,
      has_data: hasData,
      has_providers: hasProviders,
    };
  }

  private async hasActiveProviders(userId: string, agentName?: string): Promise<boolean> {
    if (!agentName) return false;
    try {
      const agent = await this.resolveAgent.resolve(userId, agentName);
      const providers = await this.providerService.getProviders(agent.id);
      return providers.some((p) => p.is_active);
    } catch {
      return false;
    }
  }
}
