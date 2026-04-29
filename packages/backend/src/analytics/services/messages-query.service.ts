import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { addTenantFilter, formatTimestamp, selectMessageRowColumns } from './query-helpers';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import type { MessageStatusFilter } from '../dto/messages-query.dto';

const ERROR_STATUSES = ['error', 'fallback_error', 'rate_limited'] as const;
import { computeCutoff, sqlCastFloat, sqlSanitizeCost } from '../../common/utils/postgres-sql';
import { inferProviderFromModel } from '../../common/utils/provider-inference';
import { TtlCache } from '../../common/utils/ttl-cache';

const MODELS_CACHE_TTL_MS = 5 * 60_000;
const DISTINCT_MODELS_DEFAULT_INTERVAL = '90 days';
const COUNT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 5_000;

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
    private readonly tenantCache: TenantCacheService,
  ) {}

  async getMessages(params: {
    range?: string;
    userId: string;
    provider?: string;
    service_type?: string;
    cost_min?: number;
    cost_max?: number;
    limit: number;
    cursor?: string;
    agent_name?: string;
    status?: MessageStatusFilter;
  }) {
    const tenantId = (await this.tenantCache.resolve(params.userId)) ?? undefined;
    const baseQb = await this.buildBaseMessageQuery(params, tenantId);

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

    // Run count, data, and models+providers queries in parallel. The models
    // query row shape includes both model and provider so we can derive the
    // full provider set in a single round trip.
    const cachedCount = params.cursor ? this.countCache.get(countCacheKey) : undefined;
    const countHit = cachedCount !== undefined;
    const [countResult, rows, distinctRows] = await Promise.all([
      countHit ? null : countQb.getRawOne(),
      dataQb
        .orderBy('at.timestamp', 'DESC')
        .addOrderBy('at.id', 'DESC')
        .limit(params.limit + 1)
        .getRawMany(),
      this.getDistinctModels(params.userId, params.range, tenantId, params.agent_name),
    ]);

    const totalCount = countHit
      ? cachedCount
      : this.cacheAndReturnCount(countCacheKey, Number(countResult?.total ?? 0));

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit);
    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem) : null;
    const providers = this.deriveProviders(distinctRows.models, distinctRows.providers);

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      providers,
    };
  }

  private async buildBaseMessageQuery(
    params: {
      range?: string;
      userId: string;
      provider?: string;
      service_type?: string;
      cost_min?: number;
      cost_max?: number;
      agent_name?: string;
      status?: MessageStatusFilter;
    },
    tenantId: string | undefined,
  ): Promise<SelectQueryBuilder<AgentMessage>> {
    const cutoff = params.range ? computeCutoff(rangeToInterval(params.range)) : undefined;
    const qb = this.turnRepo.createQueryBuilder('at');
    if (cutoff) qb.where('at.timestamp >= :cutoff', { cutoff });

    addTenantFilter(qb, params.userId, undefined, tenantId);

    if (params.service_type)
      qb.andWhere('at.service_type = :serviceType', { serviceType: params.service_type });
    if (params.cost_min !== undefined)
      qb.andWhere('at.cost_usd >= :costMin', { costMin: params.cost_min });
    if (params.cost_max !== undefined)
      qb.andWhere('at.cost_usd <= :costMax', { costMax: params.cost_max });
    if (params.agent_name)
      qb.andWhere('at.agent_name = :filterAgent', { filterAgent: params.agent_name });

    if (params.status === 'errors') {
      qb.andWhere('at.status IN (:...errorStatuses)', { errorStatuses: ERROR_STATUSES });
    } else if (params.status) {
      qb.andWhere('at.status = :statusFilter', { statusFilter: params.status });
    }

    if (params.provider) {
      await this.applyProviderFilter(qb, params.provider, {
        userId: params.userId,
        range: params.range,
        tenantId,
        agentName: params.agent_name,
      });
    }

    return qb;
  }

  private async applyProviderFilter(
    qb: SelectQueryBuilder<AgentMessage>,
    provider: string,
    ctx: { userId: string; range?: string; tenantId?: string; agentName?: string },
  ): Promise<void> {
    // Prefer the stored provider column (populated by the proxy from routing
    // resolution), and fall back to inference for legacy rows that pre-date
    // the column.
    const distinct = await this.getDistinctModels(
      ctx.userId,
      ctx.range,
      ctx.tenantId,
      ctx.agentName,
    );
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
    userId: string,
    range?: string,
    tenantId?: string,
    agentName?: string,
  ): Promise<{ models: string[]; providers: string[] }> {
    const cacheKey = `${userId}:${agentName ?? ''}:${range ?? 'all'}`;
    const cached = this.modelsCache.get(cacheKey);
    if (cached) return cached;

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
    addTenantFilter(modelsQb, userId, agentName, tenantId);
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
    const result = {
      models: [...modelSet],
      providers: [...providerSet],
    };
    this.modelsCache.set(cacheKey, result);
    return result;
  }

  private buildCountCacheKey(params: {
    userId: string;
    range?: string;
    provider?: string;
    service_type?: string;
    agent_name?: string;
    cost_min?: number;
    cost_max?: number;
    status?: MessageStatusFilter;
  }): string {
    return [
      params.userId,
      params.range ?? '',
      params.provider ?? '',
      params.service_type ?? '',
      params.agent_name ?? '',
      params.cost_min ?? '',
      params.cost_max ?? '',
      params.status ?? '',
    ].join(':');
  }
}
