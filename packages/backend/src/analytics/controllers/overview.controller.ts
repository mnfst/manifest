import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { RangeQueryDto } from '../../common/dto/range-query.dto';
import { isHourlyRange } from '../../common/utils/range.util';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';
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
    private readonly providerService: ProviderService,
    private readonly resolveAgent: ResolveAgentService,
    @InjectRepository(AgentEnabledProvider)
    private readonly enabledProviderRepo: Repository<AgentEnabledProvider>,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    const range = query.range ?? '24h';
    const agentName = query.agent_name;
    const hourly = isHourlyRange(range);
    const tenantId = ctx.tenantId;

    const [summary, tsData, costByModel, recentActivity, activeSkills, hasData, hasProviders] =
      await Promise.all([
        this.aggregation.getSummaryMetrics(range, tenantId, agentName),
        this.timeseries.getTimeseries(range, tenantId, hourly, agentName),
        this.timeseries.getCostByModel(range, tenantId, agentName),
        this.timeseries.getRecentActivity(range, tenantId, 5, agentName),
        this.timeseries.getActiveSkills(range, tenantId, agentName),
        this.aggregation.hasAnyData(tenantId, agentName),
        this.hasActiveProviders(tenantId, agentName),
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
  async getPerAgentTimeseries(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    const { range, hourly } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerAgentTimeseries(range, ctx.tenantId, hourly);
  }

  @Get('overview/per-agent-message-timeseries')
  async getPerAgentMessageTimeseries(
    @Query() query: RangeQueryDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    const { range, hourly } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerAgentMessageTimeseries(range, ctx.tenantId, hourly);
  }

  @Get('overview/per-agent-cost-timeseries')
  async getPerAgentCostTimeseries(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    const { range, hourly } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerAgentCostTimeseries(range, ctx.tenantId, hourly);
  }

  @Get('overview/per-provider-timeseries')
  async getPerProviderTimeseries(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    const { range, hourly, agentName } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerProviderTimeseries(range, ctx.tenantId, hourly, agentName);
  }

  @Get('overview/per-provider-message-timeseries')
  async getPerProviderMessageTimeseries(
    @Query() query: RangeQueryDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    const { range, hourly, agentName } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerProviderMessageTimeseries(range, ctx.tenantId, hourly, agentName);
  }

  @Get('overview/per-provider-cost-timeseries')
  async getPerProviderCostTimeseries(
    @Query() query: RangeQueryDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    const { range, hourly, agentName } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerProviderCostTimeseries(range, ctx.tenantId, hourly, agentName);
  }

  @Get('overview/per-model-cost-timeseries')
  async getPerModelCostTimeseries(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    const { range, hourly, agentName } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerModelCostTimeseries(range, ctx.tenantId, hourly, agentName);
  }

  @Get('overview/per-model-timeseries')
  async getPerModelTimeseries(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    const { range, hourly, agentName } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerModelTimeseries(range, ctx.tenantId, hourly, agentName);
  }

  @Get('overview/per-model-message-timeseries')
  async getPerModelMessageTimeseries(
    @Query() query: RangeQueryDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    const { range, hourly, agentName } = this.deriveTimeseriesArgs(query);
    return this.timeseries.getPerModelMessageTimeseries(range, ctx.tenantId, hourly, agentName);
  }

  /**
   * Shared derivation of the (range, hourly, agentName) tuple every
   * `overview/per-*-timeseries` endpoint needs. Extracted so the per-endpoint
   * methods can't drift in how they default the range or compute `hourly`.
   */
  private deriveTimeseriesArgs(query: RangeQueryDto): {
    range: string;
    hourly: boolean;
    agentName?: string;
  } {
    const range = query.range ?? '24h';
    return {
      range,
      hourly: isHourlyRange(range),
      agentName: query.agent_name,
    };
  }

  private async hasActiveProviders(tenantId: string | null, agentName?: string): Promise<boolean> {
    if (!agentName || !tenantId) return false;
    try {
      const agent = await this.resolveAgent.resolve(tenantId, agentName);
      const providers = await this.providerService.getProviders(tenantId);
      const activeProviderIds = new Set(providers.filter((p) => p.is_active).map((p) => p.id));
      if (activeProviderIds.size === 0) return false;
      const enabledRows = await this.enabledProviderRepo.find({ where: { agent_id: agent.id } });
      return enabledRows.some((row) => activeProviderIds.has(row.tenant_provider_id));
    } catch {
      return false;
    }
  }
}
