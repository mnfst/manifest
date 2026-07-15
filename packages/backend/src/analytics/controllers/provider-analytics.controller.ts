import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { TenantProvider } from '../../entities/tenant-provider.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import {
  selectMessageRowColumns,
  filterByTenantProviderId,
  excludePlaygroundAgents,
  sqlCountMessages,
  SUCCESS_STATUS_SQL_LIST,
  addTenantFilter,
  scopeToConnection,
} from '../services/query-helpers';
import { computeCutoff } from '../../common/utils/postgres-sql';
import { sqlCastFloat, sqlSanitizeCost } from '../../common/utils/postgres-sql';
import { rangeToInterval } from '../../common/utils/range.util';

@Controller('api/v1/provider-analytics')
export class ProviderAnalyticsController {
  constructor(
    private readonly aggregation: AggregationService,
    private readonly timeseries: TimeseriesQueriesService,
    @InjectRepository(TenantProvider)
    private readonly providerRepo: Repository<TenantProvider>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  @Get()
  async getAnalytics(
    @TenantCtx() ctx: TenantContext,
    @Query('auth_type') authType?: string,
    @Query('range') range?: string,
    @Query('agent_name') agentName?: string,
    @Query('provider') provider?: string,
    @Query('label') label?: string,
    // When present, scope the summary cards + chart to one exact connection by
    // its tenant_providers id (the connection-detail page passes this). The
    // services prefer it over the provider/auth_type/label tuple.
    @Query('connection_id') connectionId?: string,
  ) {
    const validRange = this.validateRange(range);
    const hourly = validRange === '24h';
    const agent = agentName || undefined;

    const [summary, ts, attempts] = await Promise.all([
      // excludePlayground=true: Playground (is_playground) usage must not pollute
      // provider analytics aggregates.
      this.aggregation.getSummaryMetrics(
        validRange,
        ctx.tenantId,
        agent,
        authType,
        provider,
        true,
        label,
        connectionId,
      ),
      this.timeseries.getTimeseries(
        validRange,
        ctx.tenantId,
        hourly,
        agent,
        authType,
        provider,
        true,
        label,
        connectionId,
      ),
      this.getAttemptReliability(
        validRange,
        ctx.tenantId,
        agent,
        authType,
        provider,
        label,
        connectionId,
      ),
    ]);

    return {
      summary: {
        messages: summary.messages,
        tokens: summary.tokens.tokens_today,
      },
      token_usage: ts.tokenUsage,
      message_usage: ts.messageUsage,
      attempts,
    };
  }

  private async getAttemptReliability(
    range: string,
    tenantId: string | null,
    agentName?: string,
    authType?: string,
    provider?: string,
    label?: string,
    connectionId?: string,
  ): Promise<{ total: number; successful: number; success_rate: number }> {
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE at.status IN (${SUCCESS_STATUS_SQL_LIST}))`, 'successful')
      .where('at.timestamp >= :attemptCutoff', {
        attemptCutoff: computeCutoff(rangeToInterval(range)),
      });
    addTenantFilter(qb, tenantId, agentName);
    if (authType) qb.andWhere('at.auth_type = :attemptAuthType', { attemptAuthType: authType });
    if (provider) qb.andWhere('at.provider = :attemptProvider', { attemptProvider: provider });
    excludePlaygroundAgents(qb);
    scopeToConnection(qb, connectionId, label);
    const row = await qb.getRawOne();
    const total = Number(row?.total ?? 0);
    const successful = Number(row?.successful ?? 0);
    return {
      total,
      successful,
      success_rate: total === 0 ? 0 : (successful / total) * 100,
    };
  }

  @Get('per-agent-timeseries')
  async getPerAgentTimeseries(
    @TenantCtx() ctx: TenantContext,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
    @Query('label') label?: string,
    @Query('connection_id') connectionId?: string,
  ) {
    const validRange = this.validateRange(range);
    const hourly = validRange === '24h';

    return this.timeseries.getPerAgentTimeseries(
      validRange,
      ctx.tenantId,
      hourly,
      authType,
      provider,
      label,
      connectionId,
    );
  }

  @Get('per-agent-message-timeseries')
  async getPerAgentMessageTimeseries(
    @TenantCtx() ctx: TenantContext,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
    @Query('label') label?: string,
    @Query('connection_id') connectionId?: string,
  ) {
    const validRange = this.validateRange(range);
    const hourly = validRange === '24h';

    return this.timeseries.getPerAgentMessageTimeseries(
      validRange,
      ctx.tenantId,
      hourly,
      authType,
      provider,
      label,
      connectionId,
    );
  }

  @Get('per-agent-cost-timeseries')
  async getPerAgentCostTimeseries(
    @TenantCtx() ctx: TenantContext,
    @Query('auth_type') authType?: string,
    @Query('provider') provider?: string,
    @Query('range') range?: string,
    @Query('label') label?: string,
    @Query('connection_id') connectionId?: string,
  ) {
    const validRange = this.validateRange(range);
    const hourly = validRange === '24h';

    return this.timeseries.getPerAgentCostTimeseries(
      validRange,
      ctx.tenantId,
      hourly,
      authType,
      provider,
      label,
      connectionId,
    );
  }

  @Get('agents')
  async getAgents(@TenantCtx() ctx: TenantContext, @Query('auth_type') authType?: string) {
    const agents = await this.timeseries.getAgentNamesByAuthType(
      authType ?? 'subscription',
      ctx.tenantId,
    );
    return { agents };
  }

  @Get('connection-detail')
  async getConnectionDetail(
    @TenantCtx() ctx: TenantContext,
    @Query('connection_id') connectionId?: string,
  ) {
    // Every branch returns the same shape (incl. `model_usage`) so the client
    // never has to special-case a missing field.
    if (!connectionId || !ctx.tenantId)
      return { connection: null, agents: [], model_usage: [], recent_messages: [] };
    const tenantId = ctx.tenantId;

    // Look up the connection (security: must belong to the tenant)
    const conn = await this.providerRepo.findOne({
      where: { id: connectionId, tenant_id: tenantId },
    });
    if (!conn) return { connection: null, agents: [], model_usage: [], recent_messages: [] };

    const cutoff30d = computeCutoff('30 days');
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    // A connection is identified by its tenant_providers row id, stamped on
    // provider_attempts.tenant_provider_id at proxy time. Filtering on it pins every
    // widget below to the exact key that served each message — unlike the old
    // (provider, auth_type, label) tuple, two keys that share a label no longer
    // merge. Pre-upgrade rows the backfill could not disambiguate carry a NULL
    // id and so don't appear here (the documented pre-upgrade history gap).
    const connId = conn.id;

    // Global last_used_at for this connection (all time, not just 30d)
    const lastUsedRow = await filterByTenantProviderId(
      this.messageRepo
        .createQueryBuilder('at')
        .select('MAX(at.timestamp)', 'last_used_at')
        .where('at.tenant_id = :tid', { tid: tenantId }),
      connId,
    ).getRawOne();
    const lastUsedAt =
      lastUsedRow?.last_used_at instanceof Date
        ? lastUsedRow.last_used_at.toISOString()
        : lastUsedRow?.last_used_at
          ? String(lastUsedRow.last_used_at)
          : null;

    // Agents using this provider (with platform from agents table)
    const agentQb = this.messageRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect(sqlCountMessages(), 'messages')
      .addSelect('MAX(at.timestamp)', 'last_used')
      .addSelect('MAX(a.agent_platform)', 'agent_platform')
      // Additive reliability columns (same semantics as autofix-stats):
      // one row per client request (retries excluded), self-healed = Auto-fix
      // saves + successful fallback recoveries, succeeded mirrors the global
      // Success rate definition.
      .addSelect(
        `COUNT(*) FILTER (WHERE at.autofix_role IS NULL OR at.autofix_role != 'retry')`,
        'requests',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE (at.status = 'ok' AND at.fallback_from_model IS NOT NULL)
          OR (at.status = 'auto_fixed' AND at.autofix_group_id IN (
            SELECT sib.autofix_group_id FROM provider_attempts sib
            WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
              AND sib.tenant_id = at.tenant_id
          )))`,
        'self_healed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE (at.autofix_role IS NULL OR at.autofix_role != 'retry')
          AND at.status NOT IN ('error','fallback_error','rate_limited')
          AND (at.status != 'auto_fixed' OR at.autofix_group_id IN (
            SELECT sib.autofix_group_id FROM provider_attempts sib
            WHERE sib.autofix_role = 'retry' AND sib.status = 'ok'
              AND sib.tenant_id = at.tenant_id
          )))`,
        'succeeded',
      )
      // Join on agent identity, not name: a soft-deleted agent sharing a slug
      // with a live one would otherwise match twice and double this breakdown's
      // per-agent tokens/cost/message counts. This one-to-(0/1) join is only for
      // the `agent_platform` column; playground-agent exclusion is handled by the
      // NOT EXISTS semi-join in excludePlaygroundAgents (catches id- AND name-only
      // Playground rows without re-introducing duplication).
      .leftJoin('agents', 'a', 'a.id = at.agent_id')
      .where('at.tenant_id = :tid', { tid: tenantId })
      .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff30d })
      .andWhere('at.agent_name IS NOT NULL');
    // Exclude the reserved Playground (is_playground) agent from the breakdown.
    excludePlaygroundAgents(agentQb);
    filterByTenantProviderId(agentQb, connId);
    const agentRows = await agentQb.groupBy('at.agent_name').orderBy('tokens', 'DESC').getRawMany();

    // Model usage (30d)
    const modelQb = this.messageRepo
      .createQueryBuilder('at')
      .select('at.model', 'model')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect(sqlCountMessages(), 'messages')
      .where('at.tenant_id = :tid', { tid: tenantId })
      .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff30d })
      .andWhere('at.model IS NOT NULL');
    // Same Playground exclusion as the agent breakdown, so the per-model token
    // sum stays equal to the per-agent sum (both cover the same messages).
    excludePlaygroundAgents(modelQb);
    filterByTenantProviderId(modelQb, connId);
    const modelRows = await modelQb.groupBy('at.model').orderBy('tokens', 'DESC').getRawMany();

    const totalModelTokens = modelRows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + Number(r['tokens'] ?? 0),
      0,
    );

    // Recent messages (top 5)
    const msgQb = selectMessageRowColumns(
      this.messageRepo.createQueryBuilder('at'),
      costExpr,
    ).where('at.tenant_id = :tid', { tid: tenantId });
    // Keep reserved Playground runs out of the recent-messages list too.
    excludePlaygroundAgents(msgQb);
    filterByTenantProviderId(msgQb, connId);
    const recentMessages = await msgQb.orderBy('at.timestamp', 'DESC').limit(5).getRawMany();

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
            requests_30d: Number(r['requests'] ?? 0),
            self_healed_30d: Number(r['self_healed'] ?? 0),
            succeeded_30d: Number(r['succeeded'] ?? 0),
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

  private validateRange(range?: string): string {
    return range === '7d' || range === '30d' || range === '90d' || range === '365d' ? range : '24h';
  }
}
