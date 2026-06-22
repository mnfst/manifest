import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { addTenantFilter, formatTimestamp, selectMessageRowColumns } from './query-helpers';
import type { MessageStatusFilter } from '../dto/messages-query.dto';

const ERROR_STATUSES = ['error', 'fallback_error', 'rate_limited'] as const;
import { computeCutoff, sqlCastFloat, sqlSanitizeCost } from '../../common/utils/postgres-sql';
import { inferProviderFromModel } from '../../common/utils/provider-inference';
import { TtlCache } from '../../common/utils/ttl-cache';

const MODELS_CACHE_TTL_MS = 5 * 60_000;
const DISTINCT_MODELS_DEFAULT_INTERVAL = '90 days';
const COUNT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 5_000;

// Recursive loose-index-scan ("skip scan") that enumerates a tenant's distinct
// models without scanning/sorting every row: the base case grabs the smallest
// value via the (tenant_id, model) index, and each recursive step seeks the next
// value strictly greater than the last. ~one index seek per distinct value.
// $1 (tenant_id) is reused by position across all three references.
const DISTINCT_MODELS_SKIP_SCAN_SQL = `
WITH RECURSIVE t AS (
  (SELECT model FROM agent_messages
     WHERE tenant_id = $1 AND model IS NOT NULL AND model <> ''
     ORDER BY model LIMIT 1)
  UNION ALL
  SELECT (SELECT model FROM agent_messages
            WHERE tenant_id = $1 AND model > t.model AND model IS NOT NULL AND model <> ''
            ORDER BY model LIMIT 1)
  FROM t WHERE t.model IS NOT NULL
)
SELECT model FROM t WHERE model IS NOT NULL`;

// Same technique for distinct providers, backed by the partial
// IDX_agent_messages_tenant_provider_value (tenant_id, provider) index.
const DISTINCT_PROVIDERS_SKIP_SCAN_SQL = `
WITH RECURSIVE p AS (
  (SELECT provider FROM agent_messages
     WHERE tenant_id = $1 AND provider IS NOT NULL AND provider <> ''
     ORDER BY provider LIMIT 1)
  UNION ALL
  SELECT (SELECT provider FROM agent_messages
            WHERE tenant_id = $1 AND provider > p.provider AND provider IS NOT NULL AND provider <> ''
            ORDER BY provider LIMIT 1)
  FROM p WHERE p.provider IS NOT NULL
)
SELECT provider FROM p WHERE provider IS NOT NULL`;

interface MessageFilterParams {
  range?: string;
  tenantId: string | null;
  agent_name?: string;
}

interface MessageQueryParams extends MessageFilterParams {
  provider?: string;
  service_type?: string;
  cost_min?: number;
  cost_max?: number;
  limit: number;
  cursor?: string;
  status?: MessageStatusFilter;
  routing_tier?: string;
  specificity_category?: string;
  header_tier_id?: string;
  include_total?: boolean;
  include_filter_options?: boolean;
}

@Injectable()
export class MessagesQueryService {
  private readonly modelsCache = new TtlCache<string, { models: string[]; providers: string[] }>({
    maxSize: MAX_CACHE_ENTRIES,
    ttlMs: MODELS_CACHE_TTL_MS,
  });
  private readonly countCache = new TtlCache<string, number>({
    maxSize: MAX_CACHE_ENTRIES,
    ttlMs: COUNT_CACHE_TTL_MS,
  });

  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
  ) {}

  async getMessages(params: MessageQueryParams) {
    const baseQb = await this.buildBaseMessageQuery(params);

    const includeTotal = params.include_total !== false;
    const includeFilterOptions = params.include_filter_options !== false;
    const countCacheKey = this.buildCountCacheKey(params);
    const countQb = baseQb.clone().select('COUNT(*)', 'total');

    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'));
    const dataQb = selectMessageRowColumns(baseQb.clone(), costExpr)
      .addSelect('at.description', 'description')
      .addSelect('at.service_type', 'service_type')
      .addSelect('at.cache_read_tokens', 'cache_read_tokens')
      .addSelect('at.cache_creation_tokens', 'cache_creation_tokens')
      .addSelect('at.duration_ms', 'duration_ms')
      .addSelect('at.error_http_status', 'error_http_status');

    this.applyCursor(dataQb, params.cursor);

    // Only reuse a cached count on paginated (cursor) requests; the first page
    // always runs a fresh count so the total stays current for clients that poll
    // it (a stale first-page total would lag newly recorded messages by the TTL).
    const cachedCount =
      includeTotal && params.cursor ? this.countCache.get(countCacheKey) : undefined;
    const countHit = cachedCount !== undefined;
    const [countResult, rows, filterOptions] = await Promise.all([
      includeTotal ? (countHit ? null : countQb.getRawOne()) : null,
      dataQb
        .orderBy('at.timestamp', 'DESC')
        .addOrderBy('at.id', 'DESC')
        .limit(params.limit + 1)
        .getRawMany(),
      includeFilterOptions
        ? this.getMessageFilterOptions(params)
        : Promise.resolve({ providers: [] as string[], provider_labels: {} }),
    ]);

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit);
    let totalCount: number;
    if (!includeTotal) {
      totalCount = items.length;
      if (hasMore) totalCount += 1;
    } else if (cachedCount !== undefined) {
      totalCount = cachedCount;
    } else {
      totalCount = this.cacheAndReturnCount(countCacheKey, Number(countResult?.total ?? 0));
    }
    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      total_count_exact: includeTotal,
      providers: filterOptions.providers,
      provider_labels: filterOptions.provider_labels,
    };
  }

  async getMessageFilterOptions(params: MessageFilterParams): Promise<{
    providers: string[];
    provider_labels: Record<string, string>;
  }> {
    const distinctRows = await this.getDistinctModels(
      params.tenantId,
      params.range,
      params.agent_name,
    );
    const providers = this.deriveProviders(distinctRows.models, distinctRows.providers);
    const providerLabels = await this.resolveCustomProviderLabels(providers, params.tenantId);
    return { providers, provider_labels: providerLabels };
  }

  /**
   * Map `custom:<uuid>` provider ids to their display names so the Messages
   * filter dropdown can label them. Deleted providers simply have no entry
   * and fall back to the raw id in the UI.
   */
  private async resolveCustomProviderLabels(
    providers: string[],
    tenantId: string | null,
  ): Promise<Record<string, string>> {
    const uuids = providers
      .filter((p) => p.startsWith('custom:'))
      .map((p) => p.slice('custom:'.length));
    if (uuids.length === 0 || !tenantId) return {};
    // Scope to the caller's tenant so a custom-provider display name can never
    // resolve across tenants, regardless of how the provider ids were sourced.
    const rows = await this.customProviderRepo.find({
      where: { id: In(uuids), tenant_id: tenantId },
    });
    return Object.fromEntries(rows.map((cp) => [`custom:${cp.id}`, cp.name]));
  }

  private async buildBaseMessageQuery(params: {
    range?: string;
    tenantId: string | null;
    provider?: string;
    service_type?: string;
    cost_min?: number;
    cost_max?: number;
    agent_name?: string;
    status?: MessageStatusFilter;
    routing_tier?: string;
    specificity_category?: string;
    header_tier_id?: string;
  }): Promise<SelectQueryBuilder<AgentMessage>> {
    const cutoff = params.range ? computeCutoff(rangeToInterval(params.range)) : undefined;
    const qb = this.turnRepo.createQueryBuilder('at');
    if (cutoff) qb.where('at.timestamp >= :cutoff', { cutoff });

    addTenantFilter(qb, params.tenantId);

    if (params.service_type)
      qb.andWhere('at.service_type = :serviceType', { serviceType: params.service_type });
    if (params.cost_min !== undefined)
      qb.andWhere('at.cost_usd >= :costMin', { costMin: params.cost_min });
    if (params.cost_max !== undefined)
      qb.andWhere('at.cost_usd <= :costMax', { costMax: params.cost_max });
    if (params.agent_name) {
      qb.andWhere(
        `at.agent_id = (
          SELECT id FROM agents
          WHERE tenant_id = at.tenant_id
            AND name = :filterAgent
            AND deleted_at IS NULL
          LIMIT 1
        )`,
        { filterAgent: params.agent_name },
      );
    }

    if (params.status === 'errors') {
      qb.andWhere('at.status IN (:...errorStatuses)', { errorStatuses: ERROR_STATUSES });
    } else if (params.status) {
      qb.andWhere('at.status = :statusFilter', { statusFilter: params.status });
    }

    if (params.routing_tier) {
      qb.andWhere('at.routing_tier = :tierFilter', { tierFilter: params.routing_tier });
    }

    if (params.specificity_category) {
      qb.andWhere('at.specificity_category = :specificityFilter', {
        specificityFilter: params.specificity_category,
      });
    }

    if (params.header_tier_id) {
      qb.andWhere('at.header_tier_id = :headerTierFilter', {
        headerTierFilter: params.header_tier_id,
      });
    }

    if (params.provider) {
      await this.applyProviderFilter(qb, params.provider, {
        tenantId: params.tenantId,
        range: params.range,
        agentName: params.agent_name,
      });
    }

    return qb;
  }

  private async applyProviderFilter(
    qb: SelectQueryBuilder<AgentMessage>,
    provider: string,
    ctx: { tenantId: string | null; range?: string; agentName?: string },
  ): Promise<void> {
    // Prefer the stored provider column (populated by the proxy from routing
    // resolution), and fall back to inference for legacy rows that pre-date
    // the column.
    const distinct = await this.getDistinctModels(ctx.tenantId, ctx.range, ctx.agentName);
    const matching = distinct.models.filter((m) => inferProviderFromModel(m) === provider);
    qb.andWhere(
      new Brackets((sub) => {
        sub.where('at.provider = :providerId', { providerId: provider });
        if (matching.length > 0) {
          sub.orWhere(
            new Brackets((inner) => {
              inner
                .where('at.provider IS NULL')
                .andWhere('at.model IN (:...providerModels)', { providerModels: matching });
            }),
          );
        }
      }),
    );
  }

  private applyCursor(qb: SelectQueryBuilder<AgentMessage>, cursor: string | undefined): void {
    if (!cursor) return;
    const sepIdx = cursor.indexOf('|');
    if (sepIdx === -1) return;
    const cursorTs = cursor.substring(0, sepIdx);
    const cursorId = cursor.substring(sepIdx + 1);
    qb.andWhere(
      new Brackets((sub) => {
        sub.where('at.timestamp < :cursorTs', { cursorTs }).orWhere(
          new Brackets((inner) => {
            inner
              .where('at.timestamp = :cursorTs2', { cursorTs2: cursorTs })
              .andWhere('at.id < :cursorId', { cursorId });
          }),
        );
      }),
    );
  }

  private encodeCursor(lastItem: Record<string, unknown>): string {
    const ts = lastItem['timestamp'];
    const tsStr = ts instanceof Date ? formatTimestamp(ts) : String(ts ?? '');
    return `${tsStr}|${String(lastItem['id'])}`;
  }

  private cacheAndReturnCount(key: string, value: number): number {
    this.countCache.set(key, value);
    return value;
  }

  /**
   * Derive sorted unique provider IDs. Combines:
   *   1. Providers explicitly stored on message rows (accurate, populated by
   *      the proxy from routing resolution).
   *   2. Providers inferred from the distinct model list for legacy rows
   *      that pre-date the stored column.
   */
  private deriveProviders(models: string[], storedProviders: string[]): string[] {
    const seen = new Set<string>();
    for (const p of storedProviders) {
      if (p) seen.add(p);
    }
    for (const m of models) {
      const p = inferProviderFromModel(m);
      if (p) seen.add(p);
    }
    return [...seen].sort();
  }

  private async getDistinctModels(
    tenantId: string | null,
    range?: string,
    agentName?: string,
  ): Promise<{ models: string[]; providers: string[] }> {
    const cacheKey = `${tenantId ?? 'no-tenant'}:${agentName ?? ''}:${range ?? 'all'}`;
    const cached = this.modelsCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: the tenant-global filter dropdown (no agent constraint, tenant
    // resolved). A recursive loose-index-scan jumps value-to-value through
    // IDX_agent_messages_tenant_model / IDX_agent_messages_tenant_provider_value
    // — roughly one index seek per distinct value, versus scanning and
    // disk-sorting the tenant's entire history (measured 2.2s -> ~10ms on a
    // 322k-row tenant). The window is intentionally all-time: cost is now bounded
    // by cardinality, and a rarely-used older model in the dropdown is harmless.
    // The per-agent / no-tenant cases stay on the bounded scan below — they touch
    // far fewer rows (or lack a supporting index for the skip scan).
    const result =
      tenantId && !agentName
        ? await this.getDistinctModelsViaSkipScan(tenantId)
        : await this.getDistinctModelsViaScan(tenantId, range, agentName);

    this.modelsCache.set(cacheKey, result);
    return result;
  }

  private async getDistinctModelsViaSkipScan(
    tenantId: string,
  ): Promise<{ models: string[]; providers: string[] }> {
    const [modelRows, providerRows] = (await Promise.all([
      this.turnRepo.query(DISTINCT_MODELS_SKIP_SCAN_SQL, [tenantId]),
      this.turnRepo.query(DISTINCT_PROVIDERS_SKIP_SCAN_SQL, [tenantId]),
    ])) as [{ model: string }[], { provider: string }[]];
    return {
      models: modelRows.map((r) => String(r.model)).filter((m) => m !== ''),
      providers: providerRows.map((r) => String(r.provider)).filter((p) => p !== ''),
    };
  }

  private async getDistinctModelsViaScan(
    tenantId: string | null,
    range: string | undefined,
    agentName: string | undefined,
  ): Promise<{ models: string[]; providers: string[] }> {
    // Bound the scan: when the caller doesn't constrain the range, default to
    // the last 90 days. The DISTINCT covers the entire agent_messages table
    // otherwise, which scales poorly as ingest grows.
    const cutoff = range
      ? computeCutoff(rangeToInterval(range))
      : computeCutoff(DISTINCT_MODELS_DEFAULT_INTERVAL);
    const modelsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.model', 'model')
      .addSelect('at.provider', 'provider')
      .distinct(true)
      .where('at.model IS NOT NULL')
      .andWhere("at.model != ''")
      .andWhere('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(modelsQb, tenantId, agentName);
    const modelsResult = await modelsQb.orderBy('at.model', 'ASC').getRawMany();

    const modelSet = new Set<string>();
    const providerSet = new Set<string>();
    for (const row of modelsResult) {
      const modelValue = row['model'];
      if (modelValue != null && modelValue !== '') {
        modelSet.add(String(modelValue));
      }
      const providerValue = row['provider'];
      if (providerValue != null && providerValue !== '') {
        providerSet.add(String(providerValue));
      }
    }
    return { models: [...modelSet], providers: [...providerSet] };
  }

  private buildCountCacheKey(params: {
    tenantId: string | null;
    range?: string;
    provider?: string;
    service_type?: string;
    agent_name?: string;
    cost_min?: number;
    cost_max?: number;
    status?: MessageStatusFilter;
    routing_tier?: string;
    specificity_category?: string;
    header_tier_id?: string;
  }): string {
    return [
      params.tenantId ?? 'no-tenant',
      params.range ?? '',
      params.provider ?? '',
      params.service_type ?? '',
      params.agent_name ?? '',
      params.cost_min ?? '',
      params.cost_max ?? '',
      params.status ?? '',
      params.routing_tier ?? '',
      params.specificity_category ?? '',
      params.header_tier_id ?? '',
    ].join(':');
  }
}
