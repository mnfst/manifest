import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

@Controller('api/v1/provider-analytics')
export class ProviderAnalyticsController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
    private readonly tenantCache: TenantCacheService,
  ) {}

  @Get()
  async getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('range') range?: string,
    @Query('agent_name') agentName?: string,
  ) {
    const validRange = range === '30d' ? '30d' : range === '7d' ? '7d' : '24h';
    const hourly = validRange === '24h';
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;
    const agent = agentName || undefined;

    const [summary, ts] = await Promise.all([
      this.aggregation.getSummaryMetrics(validRange, user.id, tenantId, agent, authType),
      this.timeseries.getTimeseries(validRange, user.id, hourly, tenantId, agent, authType),
    ]);

    return {
      summary: {
        messages: summary.messages,
        tokens: summary.tokens.tokens_today,
      },
      token_usage: ts.tokenUsage,
      message_usage: ts.messageUsage,
    };
  }

  @Get('agents')
  async getAgents(@CurrentUser() user: AuthUser, @Query('auth_type') authType?: string) {
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;
    const agents = await this.timeseries.getAgentNamesByAuthType(
      authType ?? 'subscription',
      user.id,
      tenantId,
    );
    return { agents };
  }
}
