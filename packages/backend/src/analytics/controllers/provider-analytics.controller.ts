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
        recent_messages: [],
      };
    }

    const cutoff30d = computeCutoff('30 days');
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    // Agents using this provider (with platform from agents table)
    const agentRows = await this.messageRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect('COUNT(*)', 'messages')
      .addSelect('MAX(at.timestamp)', 'last_used')
      .addSelect('MAX(a.agent_platform)', 'agent_platform')
      .leftJoin('agents', 'a', 'a.name = at.agent_name AND a.tenant_id = at.tenant_id')
      .where('at.tenant_id = :tid', { tid: tenant.id })
      .andWhere('at.provider = :provider', { provider: conn.provider })
      .andWhere('at.auth_type = :authType', { authType: conn.auth_type })
      .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff30d })
      .andWhere('at.agent_name IS NOT NULL')
      .groupBy('at.agent_name')
      .orderBy('tokens', 'DESC')
      .getRawMany();

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
      },
      agents: agentRows.map((r: Record<string, unknown>) => ({
        agent_name: String(r['agent_name']),
        agent_platform: r['agent_platform'] ? String(r['agent_platform']) : null,
        tokens_30d: Number(r['tokens'] ?? 0),
        messages_30d: Number(r['messages'] ?? 0),
        last_used: r['last_used']
          ? r['last_used'] instanceof Date
            ? (r['last_used'] as Date).toISOString()
            : String(r['last_used'])
          : null,
      })),
      recent_messages: recentMessages,
    };
  }
}
