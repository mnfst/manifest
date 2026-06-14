import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import {
  selectMessageRowColumns,
  filterByUserProviderId,
  excludePlaygroundAgents,
} from './query-helpers';
import { computeCutoff, sqlCastFloat, sqlSanitizeCost } from '../../common/utils/postgres-sql';

/**
 * Query layer for the provider connection-detail page: connection metadata
 * plus its per-agent / per-model / recent-message usage breakdowns.
 *
 * A connection is identified by its user_providers row id, stamped on
 * agent_messages.user_provider_id at proxy time. Filtering on it pins every
 * widget to the exact key that served each message — unlike the old
 * (provider, auth_type, label) tuple, two keys that share a label no longer
 * merge. Pre-upgrade rows the backfill could not disambiguate carry a NULL id
 * and so don't appear here (the documented pre-upgrade history gap).
 */
@Injectable()
export class ConnectionDetailService {
  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async getConnectionDetail(userId: string, connectionId?: string) {
    // Every branch returns the same shape (incl. `model_usage`) so the client
    // never has to special-case a missing field.
    if (!connectionId) return this.emptyDetail();

    // Look up the connection (security: must belong to the user)
    const conn = await this.providerRepo.findOne({
      where: { id: connectionId, user_id: userId },
    });
    if (!conn) return this.emptyDetail();

    // Resolve the tenant via the shared cache like every other analytics
    // endpoint, instead of re-querying the tenants table by name per request.
    const tenantId = await this.tenantCache.resolve(userId);
    if (!tenantId) {
      return { ...this.emptyDetail(), connection: this.mapConnection(conn) };
    }

    const cutoff30d = computeCutoff('30 days');
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));

    const [lastUsedAt, agentRows, modelRows, recentMessages] = await Promise.all([
      this.fetchLastUsedAt(tenantId, conn.id),
      this.fetchAgentRows(tenantId, conn.id, cutoff30d, costExpr),
      this.fetchModelRows(tenantId, conn.id, cutoff30d, costExpr),
      this.fetchRecentMessages(tenantId, conn.id, costExpr),
    ]);

    return {
      connection: {
        ...this.mapConnection(conn),
        is_active: conn.is_active,
        last_used_at: lastUsedAt,
      },
      agents: this.mapAgentBreakdown(agentRows),
      model_usage: this.mapModelUsage(modelRows),
      recent_messages: recentMessages,
    };
  }

  private emptyDetail() {
    return {
      connection: null as Record<string, unknown> | null,
      agents: [] as Array<Record<string, unknown>>,
      model_usage: [] as Array<Record<string, unknown>>,
      recent_messages: [] as Array<Record<string, unknown>>,
    };
  }

  private mapConnection(conn: UserProvider) {
    return {
      id: conn.id,
      provider: conn.provider,
      auth_type: conn.auth_type,
      label: conn.label,
      cached_model_count: Array.isArray(conn.cached_models) ? conn.cached_models.length : 0,
      key_prefix: conn.key_prefix,
      connected_at: conn.connected_at,
    };
  }

  /** Global last_used_at for this connection (all time, not just 30d). */
  private async fetchLastUsedAt(tenantId: string, connId: string): Promise<string | null> {
    const lastUsedRow = await filterByUserProviderId(
      this.messageRepo
        .createQueryBuilder('at')
        .select('MAX(at.timestamp)', 'last_used_at')
        .where('at.tenant_id = :tid', { tid: tenantId }),
      connId,
    ).getRawOne();
    return lastUsedRow?.last_used_at instanceof Date
      ? lastUsedRow.last_used_at.toISOString()
      : lastUsedRow?.last_used_at
        ? String(lastUsedRow.last_used_at)
        : null;
  }

  /** Agents using this connection in the last 30d (with platform from agents). */
  private async fetchAgentRows(
    tenantId: string,
    connId: string,
    cutoff30d: string,
    costExpr: string,
  ): Promise<Array<Record<string, unknown>>> {
    const agentQb = this.messageRepo
      .createQueryBuilder('at')
      .select('at.agent_name', 'agent_name')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect('COUNT(*)', 'messages')
      .addSelect('MAX(at.timestamp)', 'last_used')
      .addSelect('MAX(a.agent_platform)', 'agent_platform')
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
    filterByUserProviderId(agentQb, connId);
    return agentQb.groupBy('at.agent_name').orderBy('tokens', 'DESC').getRawMany();
  }

  /** Model usage for this connection in the last 30d. */
  private async fetchModelRows(
    tenantId: string,
    connId: string,
    cutoff30d: string,
    costExpr: string,
  ): Promise<Array<Record<string, unknown>>> {
    const modelQb = this.messageRepo
      .createQueryBuilder('at')
      .select('at.model', 'model')
      .addSelect('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'tokens')
      .addSelect(`COALESCE(SUM(${costExpr}), 0)`, 'cost')
      .addSelect('COUNT(*)', 'messages')
      .where('at.tenant_id = :tid', { tid: tenantId })
      .andWhere('at.timestamp >= :cutoff', { cutoff: cutoff30d })
      .andWhere('at.model IS NOT NULL');
    // Same Playground exclusion as the agent breakdown, so the per-model token
    // sum stays equal to the per-agent sum (both cover the same messages).
    excludePlaygroundAgents(modelQb);
    filterByUserProviderId(modelQb, connId);
    return modelQb.groupBy('at.model').orderBy('tokens', 'DESC').getRawMany();
  }

  /** Most recent messages served by this connection (MessageRow projection). */
  private async fetchRecentMessages(
    tenantId: string,
    connId: string,
    costExpr: string,
  ): Promise<Array<Record<string, unknown>>> {
    const msgQb = selectMessageRowColumns(
      this.messageRepo.createQueryBuilder('at'),
      costExpr,
    ).where('at.tenant_id = :tid', { tid: tenantId });
    // Keep reserved Playground runs out of the recent-messages list too.
    excludePlaygroundAgents(msgQb);
    filterByUserProviderId(msgQb, connId);
    return msgQb.orderBy('at.timestamp', 'DESC').limit(5).getRawMany();
  }

  private mapAgentBreakdown(agentRows: Array<Record<string, unknown>>) {
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
  }

  private mapModelUsage(modelRows: Array<Record<string, unknown>>) {
    const totalModelTokens = modelRows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + Number(r['tokens'] ?? 0),
      0,
    );
    return modelRows.map((r: Record<string, unknown>) => {
      const tokens = Number(r['tokens'] ?? 0);
      return {
        model: String(r['model']),
        tokens,
        cost: Number(r['cost'] ?? 0),
        messages: Number(r['messages'] ?? 0),
        pct_of_total: totalModelTokens > 0 ? Math.round((tokens / totalModelTokens) * 100) : 0,
      };
    });
  }
}
