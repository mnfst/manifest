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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEnabledProvider } from '../../entities/agent-enabled-provider.entity';

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
    @InjectRepository(AgentEnabledProvider)
    private readonly enabledProviderRepo: Repository<AgentEnabledProvider>,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const range = query.range ?? '24h';
    const agentName = query.agent_name;
    const hourly = isHourlyRange(range);
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;

    const [summary, tsData, costByModel, recentActivity, activeSkills, hasData, hasProviders] =
      await Promise.all([
        // The overview excludes the reserved Playground (is_playground) agent's
        // traffic EVERYWHERE: the per-agent/per-provider charts on the same page
        // always drop it, so the summary cards, the aggregate timeseries and the
        // breakdown widgets must agree or the page contradicts itself.
        this.aggregation.getSummaryMetrics({
          range,
          userId: user.id,
          tenantId,
          agentName,
          excludePlayground: true,
        }),
        this.timeseries.getTimeseries({
          range,
          userId: user.id,
          hourly,
          tenantId,
          agentName,
          excludePlayground: true,
        }),
        this.timeseries.getCostByModel(range, user.id, agentName, tenantId, true),
        this.timeseries.getRecentActivity(range, user.id, 5, agentName, tenantId, true),
        this.timeseries.getActiveSkills(range, user.id, agentName, tenantId, true),
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

  @Get('overview/per-agent-timeseries')
  async getPerAgentTimeseries(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const { range, hourly, tenantId } = await this.deriveTimeseriesArgs(query, user);
    return this.timeseries.getPerDimensionTimeseries('agent', 'tokens', {
      range,
      userId: user.id,
      hourly,
      tenantId,
    });
  }

  @Get('overview/per-agent-message-timeseries')
  async getPerAgentMessageTimeseries(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const { range, hourly, tenantId } = await this.deriveTimeseriesArgs(query, user);
    return this.timeseries.getPerDimensionTimeseries('agent', 'messages', {
      range,
      userId: user.id,
      hourly,
      tenantId,
    });
  }

  @Get('overview/per-agent-cost-timeseries')
  async getPerAgentCostTimeseries(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const { range, hourly, tenantId } = await this.deriveTimeseriesArgs(query, user);
    return this.timeseries.getPerDimensionTimeseries('agent', 'cost', {
      range,
      userId: user.id,
      hourly,
      tenantId,
    });
  }

  @Get('overview/per-provider-timeseries')
  async getPerProviderTimeseries(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const { range, hourly, tenantId, agentName } = await this.deriveTimeseriesArgs(query, user);
    return this.timeseries.getPerDimensionTimeseries('provider', 'tokens', {
      range,
      userId: user.id,
      hourly,
      tenantId,
      agentName,
    });
  }

  @Get('overview/per-provider-message-timeseries')
  async getPerProviderMessageTimeseries(
    @Query() query: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { range, hourly, tenantId, agentName } = await this.deriveTimeseriesArgs(query, user);
    return this.timeseries.getPerDimensionTimeseries('provider', 'messages', {
      range,
      userId: user.id,
      hourly,
      tenantId,
      agentName,
    });
  }

  @Get('overview/per-provider-cost-timeseries')
  async getPerProviderCostTimeseries(@Query() query: RangeQueryDto, @CurrentUser() user: AuthUser) {
    const { range, hourly, tenantId, agentName } = await this.deriveTimeseriesArgs(query, user);
    return this.timeseries.getPerDimensionTimeseries('provider', 'cost', {
      range,
      userId: user.id,
      hourly,
      tenantId,
      agentName,
    });
  }

  /**
   * Shared derivation of the (range, hourly, tenantId, agentName) tuple every
   * `overview/per-*-timeseries` endpoint needs. Extracted so the per-endpoint
   * methods can't drift in how they default the range, compute `hourly`, or
   * resolve the tenant.
   */
  private async deriveTimeseriesArgs(
    query: RangeQueryDto,
    user: AuthUser,
  ): Promise<{ range: string; hourly: boolean; tenantId: string | undefined; agentName?: string }> {
    const range = query.range ?? '24h';
    return {
      range,
      hourly: isHourlyRange(range),
      tenantId: (await this.tenantCache.resolve(user.id)) ?? undefined,
      agentName: query.agent_name,
    };
  }

  private async hasActiveProviders(userId: string, agentName?: string): Promise<boolean> {
    if (!agentName) return false;
    try {
      const agent = await this.resolveAgent.resolve(userId, agentName);
      const providers = await this.providerService.getProviders(userId);
      const activeProviderIds = new Set(providers.filter((p) => p.is_active).map((p) => p.id));
      if (activeProviderIds.size === 0) return false;
      const enabledRows = await this.enabledProviderRepo.find({ where: { agent_id: agent.id } });
      return enabledRows.some((row) => activeProviderIds.has(row.user_provider_id));
    } catch {
      return false;
    }
  }
}
