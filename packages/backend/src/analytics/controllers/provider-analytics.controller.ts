import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { AggregationService } from '../services/aggregation.service';
import {
  TimeseriesQueriesService,
  type DimensionTimeseriesOptions,
  type SeriesMetric,
} from '../services/timeseries-queries.service';
import { ConnectionDetailService } from '../services/connection-detail.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

@Controller('api/v1/provider-analytics')
export class ProviderAnalyticsController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
    private readonly connectionDetail: ConnectionDetailService,
    private readonly tenantCache: TenantCacheService,
  ) {}

  @Get()
  async getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('range') range?: string,
    @Query('agent_name') agentName?: string,
    @Query('provider') provider?: string,
    @Query('label') label?: string,
    // When present, scope the summary cards + chart to one exact connection by
    // its user_providers id (the connection-detail page passes this). The
    // services prefer it over the provider/auth_type/label tuple.
    @Query('connection_id') connectionId?: string,
  ) {
    const validRange = this.validateRange(range);
    const hourly = validRange === '24h';
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;

    const filters = {
      range: validRange,
      userId: user.id,
      tenantId,
      agentName: agentName || undefined,
      authType,
      provider,
      // Playground (is_playground) usage must not pollute provider analytics
      // aggregates.
      excludePlayground: true,
      label,
      userProviderId: connectionId,
    };

    const [summary, ts] = await Promise.all([
      this.aggregation.getSummaryMetrics(filters),
      this.timeseries.getTimeseries({ ...filters, hourly }),
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

  @Get('per-agent-timeseries')
  async getPerAgentTimeseries(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
    @Query('label') label?: string,
    @Query('connection_id') connectionId?: string,
  ) {
    return this.getPerAgentSeries('tokens', user, authType, provider, range, label, connectionId);
  }

  @Get('per-agent-message-timeseries')
  async getPerAgentMessageTimeseries(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
    @Query('label') label?: string,
    @Query('connection_id') connectionId?: string,
  ) {
    return this.getPerAgentSeries('messages', user, authType, provider, range, label, connectionId);
  }

  @Get('per-agent-cost-timeseries')
  async getPerAgentCostTimeseries(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
    @Query('label') label?: string,
    @Query('connection_id') connectionId?: string,
  ) {
    return this.getPerAgentSeries('cost', user, authType, provider, range, label, connectionId);
  }

  @Get('connection-detail')
  async getConnectionDetail(
    @CurrentUser() user: AuthUser,
    @Query('connection_id') connectionId?: string,
  ) {
    return this.connectionDetail.getConnectionDetail(user.id, connectionId);
  }

  /** Shared delegation for the three per-agent series endpoints above. */
  private async getPerAgentSeries(
    metric: SeriesMetric,
    user: AuthUser,
    authType?: string,
    provider?: string,
    range?: string,
    label?: string,
    connectionId?: string,
  ) {
    const validRange = this.validateRange(range);
    const options: DimensionTimeseriesOptions = {
      range: validRange,
      userId: user.id,
      hourly: validRange === '24h',
      tenantId: (await this.tenantCache.resolve(user.id)) ?? undefined,
      authType,
      provider,
      label,
      userProviderId: connectionId,
    };
    return this.timeseries.getPerDimensionTimeseries('agent', metric, options);
  }

  private validateRange(range?: string): string {
    return range === '30d' ? '30d' : range === '7d' ? '7d' : '24h';
  }
}
