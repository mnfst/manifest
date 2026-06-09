import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Tenant } from '../../entities/tenant.entity';
import { selectMessageRowColumns } from '../services/query-helpers';
import { computeCutoff } from '../../common/utils/postgres-sql';
import { sqlCastFloat, sqlSanitizeCost } from '../../common/utils/postgres-sql';

@Controller('api/v1/provider-analytics')
export class ProviderAnalyticsController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
    private readonly tenantCache: TenantCacheService,
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  @Get()
  async getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('range') range?: string,
    @Query('agent_name') agentName?: string,
    @Query('provider') provider?: string,
  ) {
    const validRange = range === '30d' ? '30d' : range === '7d' ? '7d' : '24h';
    const hourly = validRange === '24h';
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;
    const agent = agentName || undefined;

    const [summary, ts] = await Promise.all([
      this.aggregation.getSummaryMetrics(validRange, user.id, tenantId, agent, authType, provider),
      this.timeseries.getTimeseries(
        validRange,
        user.id,
        hourly,
        tenantId,
        agent,
        authType,
        provider,
      ),
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
  ) {
    const validRange = range === '30d' ? '30d' : range === '7d' ? '7d' : '24h';
    const hourly = validRange === '24h';
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;

    return this.timeseries.getPerAgentTimeseries(
      validRange,
      user.id,
      hourly,
      tenantId,
      authType,
      provider,
    );
  }

  @Get('per-agent-message-timeseries')
  async getPerAgentMessageTimeseries(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
  ) {
    const validRange = range === '30d' ? '30d' : range === '7d' ? '7d' : '24h';
    const hourly = validRange === '24h';
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;

    return this.timeseries.getPerAgentMessageTimeseries(
      validRange,
      user.id,
      hourly,
      tenantId,
      authType,
      provider,
    );
  }

  @Get('per-agent-cost-timeseries')
  async getPerAgentCostTimeseries(
    @CurrentUser() user: AuthUser,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
  ) {
    const validRange = range === '30d' ? '30d' : range === '7d' ? '7d' : '24h';
    const hourly = validRange === '24h';
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;

    return this.timeseries.getPerAgentCostTimeseries(
      validRange,
      user.id,
      hourly,
      tenantId,
      authType,
      provider,
    );
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

  @Get('connection-detail')
  async getConnectionDetail(
    @CurrentUser() user: AuthUser,
    @Query('connection_id') connectionId?: string,
  ) {
    if (!connectionId) return { connection: null, agents: [], recent_messages: [] };

    // Look up the connection (security: must belong to the user)
    const conn = await this.providerRepo.findOne({
      where: { id: connectionId, user_id: user.id },
    });
    if (!conn) return { connection: null, agents: [], recent_messages: [] };

    const tenant = await this.tenantRepo.findOne({ where: { name: user.id } });
    if (!tenant) {
      return {
        connection: {
          id: conn.id,
          provider: conn.provider,
          auth_type: conn.auth_type,
          label: conn.label,
          cached_model_count: Array.isArray(conn.cached_models) ? conn.cached_models.length : 0,
          key_prefix: conn.key_prefix,
          connected_at: conn.connected_at,
        },
        agents: [],
        model_usage: [],
        recent_messages: [],
      };
    }

    const cutoff30d = computeCutoff('30 days');
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    // Global last_used_at for this connection (all time, not just 30d)
    const lastUsedRow = await this.messageRepo
      .createQueryBuilder('at')
      .select('MAX(at.timestamp)', 'last_used_at')
      .where('at.tenant_id = :tid', { tid: tenant.id })
      .andWhere('at.provider = :provider', { provider: conn.provider })
      .andWhere('at.auth_type = :authType', { authType: conn.auth_type })
      .getRawOne();
    const lastUsedAt =
      lastUsedRow?.last_used_at instanceof Date
        ? lastUsedRow.last_used_at.toISOString()
        : lastUsedRow?.last_used_at
          ? String(lastUsedRow.last_used_at)
          : null;

    // Agents using this provider (with platform from agents table)
    const agentRows = await this.messageRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect('COUNT(*)', 'messages')
      .addSelect('MAX(at.timestamp)', 'last_used')
      .addSelect('MAX(a.agent_platform)', 'agent_platform')
      .leftJoin('agents', 'a', 'a.name = at.agent_name AND a.tenant_id = at.tenant_id')
      .where('at.tenant_id = :tid', { tid: tenant.id })
      .andWhere('at.provider = :provider', { provider: conn.provider })
      .andWhere('at.auth_type = :authType', { authType: conn.auth_type })
      .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff30d })
      .andWhere('at.agent_name IS NOT NULL')
      // Exclude the reserved Playground (is_system) agent from the breakdown.
      .andWhere('(a.is_system IS NULL OR a.is_system = false)')
      .groupBy('at.agent_name')
      .orderBy('tokens', 'DESC')
      .getRawMany();

    // Model usage (30d)
    const modelRows = await this.messageRepo
      .createQueryBuilder('at')
      .select('at.model', 'model')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect('COUNT(*)', 'messages')
      .where('at.tenant_id = :tid', { tid: tenant.id })
      .andWhere('at.provider = :provider', { provider: conn.provider })
      .andWhere('at.auth_type = :authType', { authType: conn.auth_type })
      .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff30d })
      .andWhere('at.model IS NOT NULL')
      .groupBy('at.model')
      .orderBy('tokens', 'DESC')
      .getRawMany();

    const totalModelTokens = modelRows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + Number(r['tokens'] ?? 0),
      0,
    );

    // Recent messages (top 5)
    const msgQb = selectMessageRowColumns(this.messageRepo.createQueryBuilder('at'), costExpr)
      .where('at.tenant_id = :tid', { tid: tenant.id })
      .andWhere('at.provider = :provider', { provider: conn.provider })
      .andWhere('at.auth_type = :authType', { authType: conn.auth_type })
      .orderBy('at.timestamp', 'DESC')
      .limit(5);
    const recentMessages = await msgQb.getRawMany();

    return {
      connection: {
        id: conn.id,
        provider: conn.provider,
        auth_type: conn.auth_type,
        label: conn.label,
        cached_model_count: Array.isArray(conn.cached_models) ? conn.cached_models.length : 0,
        key_prefix: conn.key_prefix,
        connected_at: conn.connected_at,
        is_active: conn.is_active,
        last_used_at: lastUsedAt,
      },
      agents: (() => {
        const totalAgentTokens = agentRows.reduce(
          (sum: number, r: Record<string, unknown>) => sum + Number(r['tokens'] ?? 0),
          0,
        );
        return agentRows.map((r: Record<string, unknown>) => {
          const tokens = Number(r['tokens'] ?? 0);
          return {
            agent_name: String(r['agent_name']),
            agent_platform: r['agent_platform'] ? String(r['agent_platform']) : null,
            tokens_30d: tokens,
            cost_30d: Number(r['cost'] ?? 0),
            messages_30d: Number(r['messages'] ?? 0),
            pct_of_total: totalAgentTokens > 0 ? Math.round((tokens / totalAgentTokens) * 100) : 0,
            last_used: r['last_used']
              ? r['last_used'] instanceof Date
                ? (r['last_used'] as Date).toISOString()
                : String(r['last_used'])
              : null,
          };
        });
      })(),
      model_usage: modelRows.map((r: Record<string, unknown>) => {
        const tokens = Number(r['tokens'] ?? 0);
        return {
          model: String(r['model']),
          tokens,
          cost: Number(r['cost'] ?? 0),
          messages: Number(r['messages'] ?? 0),
          pct_of_total: totalModelTokens > 0 ? Math.round((tokens / totalModelTokens) * 100) : 0,
        };
      }),
      recent_messages: recentMessages,
    };
  }
}
