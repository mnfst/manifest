import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { addTenantFilter, formatTimestamp } from './query-helpers';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import {
  DbDialect,
  detectDialect,
  computeCutoff,
  sqlCastFloat,
  sqlSanitizeCost,
} from '../../common/utils/sql-dialect';
import { inferProviderFromModel } from '../../common/utils/provider-inference';
import { TtlCache } from '../../common/utils/ttl-cache';

const MODELS_CACHE_TTL_MS = 60_000;
const COUNT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 5_000;

@Injectable()
export class MessagesQueryService {
  private readonly dialect: DbDialect;
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
    private readonly dataSource: DataSource,
    private readonly tenantCache: TenantCacheService,
  ) {
    this.dialect = detectDialect(this.dataSource.options.type as string);
  }

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
  }) {
    const tenantId = (await this.tenantCache.resolve(params.userId)) ?? undefined;
    const cutoff = params.range ? computeCutoff(rangeToInterval(params.range)) : undefined;

    const baseQb = this.turnRepo.createQueryBuilder('at');
    if (cutoff) {
      baseQb.where('at.timestamp >= :cutoff', { cutoff });
    }

    addTenantFilter(baseQb, params.userId, undefined, tenantId);

    if (params.service_type)
      baseQb.andWhere('at.service_type = :serviceType', { serviceType: params.service_type });
    if (params.cost_min !== undefined)
      baseQb.andWhere('at.cost_usd >= :costMin', { costMin: params.cost_min });
    if (params.cost_max !== undefined)
      baseQb.andWhere('at.cost_usd <= :costMax', { costMax: params.cost_max });
    if (params.agent_name)
      baseQb.andWhere('at.agent_name = :filterAgent', { filterAgent: params.agent_name });

    // Provider filter: prefer the stored provider column (populated by the
    // proxy from routing resolution), and fall back to inference for legacy
    // rows that pre-date the column.
    if (params.provider) {
      const distinct = await this.getDistinctModels(
        params.userId,
        params.range,
        tenantId,
        params.agent_name,
      );
      const matching = distinct.models.filter((m) => inferProviderFromModel(m) === params.provider);
      baseQb.andWhere(
        new Brackets((sub) => {
          sub.where('at.provider = :providerId', { providerId: params.provider });
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

    // Count (without cursor) — use cache for repeat/paginated requests
    const countCacheKey = this.buildCountCacheKey(params);
    const countQb = baseQb.clone().select('COUNT(*)', 'total');

    // Data (with cursor) — treat negative costs as NULL (invalid pricing)
    const costExpr = sqlCastFloat(sqlSanitizeCost('at.cost_usd'), this.dialect);
    const dataQb = baseQb
      .clone()
      .select('at.id', 'id')
      .addSelect('at.timestamp', 'timestamp')
      .addSelect('at.agent_name', 'agent_name')
      .addSelect('at.model', 'model')
      .addSelect('at.provider', 'provider')
      .addSelect('at.model', 'display_name')
      .addSelect('at.description', 'description')
      .addSelect('at.service_type', 'service_type')
      .addSelect('at.input_tokens', 'input_tokens')
      .addSelect('at.output_tokens', 'output_tokens')
      .addSelect('at.status', 'status')
      .addSelect('at.input_tokens + at.output_tokens', 'total_tokens')
      .addSelect(costExpr, 'cost')
      .addSelect('at.routing_tier', 'routing_tier')
      .addSelect('at.routing_reason', 'routing_reason')
      .addSelect('at.specificity_category', 'specificity_category')
      .addSelect('at.cache_read_tokens', 'cache_read_tokens')
      .addSelect('at.cache_creation_tokens', 'cache_creation_tokens')
      .addSelect('at.duration_ms', 'duration_ms')
      .addSelect('at.error_message', 'error_message')
      .addSelect('at.error_http_status', 'error_http_status')
      .addSelect('at.auth_type', 'auth_type')
      .addSelect('at.fallback_from_model', 'fallback_from_model')
      .addSelect('at.fallback_index', 'fallback_index');

    if (params.cursor) {
      const sepIdx = params.cursor.indexOf('|');
      if (sepIdx !== -1) {
        const cursorTs = params.cursor.substring(0, sepIdx);
        const cursorId = params.cursor.substring(sepIdx + 1);
        dataQb.andWhere(
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
    }

    // Run count, data, and models+providers queries in parallel.
    // The models query row shape includes both model and provider so we can
    // derive the full provider set in a single round trip.
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
    const allModels = distinctRows.models;
    const storedProviders = distinctRows.providers;

    let totalCount: number;
    if (countHit) {
      totalCount = cachedCount;
    } else {
      totalCount = Number(countResult?.total ?? 0);
      this.countCache.set(countCacheKey, totalCount);
    }
    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit);
    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const ts = lastItem?.['timestamp'];
    const tsStr = ts instanceof Date ? formatTimestamp(ts) : String(ts ?? '');
    const lastId = lastItem?.['id'];
    const nextCursor = hasMore && lastItem ? `${tsStr}|${String(lastId)}` : null;

    const providers = this.deriveProviders(allModels, storedProviders);

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      providers,
    };
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

    const cutoff = range ? computeCutoff(rangeToInterval(range)) : undefined;
    const modelsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('at.model', 'model')
      .addSelect('at.provider', 'provider')
      .distinct(true)
      .where('at.model IS NOT NULL')
      .andWhere("at.model != ''");
    if (cutoff) {
      modelsQb.andWhere('at.timestamp >= :cutoff', { cutoff });
    }
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
  }): string {
    return [
      params.userId,
      params.range ?? '',
      params.provider ?? '',
      params.service_type ?? '',
      params.agent_name ?? '',
      params.cost_min ?? '',
      params.cost_max ?? '',
    ].join(':');
  }
}
