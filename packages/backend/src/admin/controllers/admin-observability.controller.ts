import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AdminAiGuard } from '../guards/admin-ai.guard';
import { TimeseriesQueriesService } from '../../analytics/services/timeseries-queries.service';
import { ResolveAgentService } from '../../routing/routing-core/resolve-agent.service';
import { ProviderService } from '../../routing/routing-core/provider.service';
import { AgentEnabledProvider } from '../../entities/agent-enabled-provider.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Read-only observability + routing visibility under the admin surface.
 * Reuses TimeseriesQueriesService (same read methods the dashboard's Overview
 * uses) and ResolveAgentService/ProviderService for routing summaries. No
 * writes; purely informational for agent administration.
 */
@Controller('api/v1/admin/observability')
@UseGuards(AdminAiGuard)
export class AdminObservabilityController {
  constructor(
    private readonly timeseries: TimeseriesQueriesService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerService: ProviderService,
    @InjectRepository(AgentEnabledProvider)
    private readonly enabledProviderRepo: Repository<AgentEnabledProvider>,
  ) {}

  @Get('usage')
  async usage(
    @TenantCtx() ctx: TenantContext,
    @Query('range') range?: string,
    @Query('hourly') hourly?: string,
  ) {
    if (!ctx.tenantId) return { series: [] };
    const r = (range as never) ?? '24h';
    // Independent reads — run concurrently instead of serializing two
    // potentially expensive timeseries scans.
    const [perAgent, perProvider] = await Promise.all([
      this.timeseries.getPerAgentTimeseries(r, ctx.tenantId, hourly === 'true'),
      this.timeseries.getPerProviderTimeseries(r, ctx.tenantId, hourly === 'true'),
    ]);
    return { perAgent, perProvider };
  }

  @Get('agents/:agentName/routing')
  async agentRouting(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    if (!ctx.tenantId) throw new NotFoundException('No tenant context');
    const agent = await this.resolveAgent.resolve(ctx.tenantId, agentName);
    const allProviders = this.providerService.getProviders(ctx.tenantId);
    const enabled = await this.enabledProviderRepo.find({ where: { agent_id: agent.id } });
    const enabledIds = new Set(enabled.map((e) => e.tenant_provider_id));
    const providers = (await allProviders).map((p) => ({
      provider: p.provider,
      auth_type: p.auth_type,
      label: p.label,
      is_active: p.is_active,
      enabled_for_agent: enabledIds.has(p.id),
    }));
    return {
      agent: { id: agent.id, name: agent.name, display_name: agent.display_name },
      providers,
    };
  }
}
