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

const MODELS_CACHE_TTL_MS = 60_000;
const COUNT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 5_000;

interface CachedModels {
  models: string[];
  expiresAt: number;
}

interface CachedCount {
  count: number;
  expiresAt: number;
}

@Injectable()
export class MessagesQueryService {
  private readonly dialect: DbDialect;
  private readonly modelsCache = new Map<string, CachedModels>();
  private readonly countCache = new Map<string, CachedCount>();

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
    status?: string;
    service_type?: string;
    model?: string;
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

    if (params.status) baseQb.andWhere('at.status = :status', { status: params.status });
    if (params.service_type)
      baseQb.andWhere('at.service_type = :serviceType', { serviceType: params.service_type });
    if (params.model) baseQb.andWhere('at.model = :model', { model: params.model });
    if (params.cost_min !== undefined)
      baseQb.andWhere('at.cost_usd >= :costMin', { costMin: params.cost_min });
    if (params.cost_max !== undefined)
      baseQb.andWhere('at.cost_usd <= :costMax', { costMax: params.cost_max });
    if (params.agent_name)
      baseQb.andWhere('at.agent_name = :filterAgent', { filterAgent: params.agent_name });

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
      .addSelect('at.description', 'description')
      .addSelect('at.service_type', 'service_type')
      .addSelect('at.input_tokens', 'input_tokens')
      .addSelect('at.output_tokens', 'output_tokens')
      .addSelect('at.status', 'status')
      .addSelect('at.input_tokens + at.output_tokens', 'total_tokens')
      .addSelect(costExpr, 'cost')
      .addSelect('at.routing_tier', 'routing_tier')
      .addSelect('at.routing_reason', 'routing_reason')
      .addSelect('at.cache_read_tokens', 'cache_read_tokens')
      .addSelect('at.cache_creation_tokens', 'cache_creation_tokens')
      .addSelect('at.duration_ms', 'duration_ms')
      .addSelect('at.error_message', 'error_message')
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

    // Run count, data, and models queries in parallel (count cached on paginated requests)
    const cachedCount = params.cursor ? this.countCache.get(countCacheKey) : undefined;
    const countHit = cachedCount && cachedCount.expiresAt > Date.now();
    const [countResult, rows, models] = await Promise.all([
      countHit ? null : countQb.getRawOne(),
      dataQb
        .orderBy('at.timestamp', 'DESC')
        .addOrderBy('at.id', 'DESC')
        .limit(params.limit + 1)
        .getRawMany(),
      this.getDistinctModels(params.userId, params.range, tenantId, params.agent_name),
    ]);

    let totalCount: number;
    if (countHit) {
      totalCount = cachedCount.count;
    } else {
      totalCount = Number(countResult?.total ?? 0);
      this.setCountCache(countCacheKey, totalCount);
    }
    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit);
    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const ts = lastItem?.['timestamp'];
    const tsStr = ts instanceof Date ? formatTimestamp(ts) : String(ts ?? '');
    const lastId = lastItem?.['id'];
    const nextCursor = hasMore && lastItem ? `${tsStr}|${String(lastId)}` : null;

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      models,
    };
  }

  private async getDistinctModels(
    userId: string,
    range?: string,
    tenantId?: string,
    agentName?: string,
  ): Promise<string[]> {
    const cacheKey = `${userId}:${agentName ?? ''}:${range ?? 'all'}`;
    const cached = this.modelsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.models;
    }
    if (cached) this.modelsCache.delete(cacheKey);

    const cutoff = range ? computeCutoff(rangeToInterval(range)) : undefined;
    const modelsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('DISTINCT at.model', 'model')
      .where('at.model IS NOT NULL')
      .andWhere("at.model != ''");
    if (cutoff) {
      modelsQb.andWhere('at.timestamp >= :cutoff', { cutoff });
    }
    addTenantFilter(modelsQb, userId, agentName, tenantId);
    const modelsResult = await modelsQb.orderBy('at.model', 'ASC').getRawMany();

    const models = modelsResult.map((r: Record<string, unknown>) => String(r['model']));
    if (this.modelsCache.size >= MAX_CACHE_ENTRIES && !this.modelsCache.has(cacheKey)) {
      const firstKey = this.modelsCache.keys().next().value;
      if (firstKey !== undefined) this.modelsCache.delete(firstKey);
    }
    this.modelsCache.set(cacheKey, { models, expiresAt: Date.now() + MODELS_CACHE_TTL_MS });
    return models;
  }

  private buildCountCacheKey(params: {
    userId: string;
    range?: string;
    status?: string;
    service_type?: string;
    model?: string;
    agent_name?: string;
    cost_min?: number;
    cost_max?: number;
  }): string {
    return [
      params.userId,
      params.range ?? '',
      params.status ?? '',
      params.service_type ?? '',
      params.model ?? '',
      params.agent_name ?? '',
      params.cost_min ?? '',
      params.cost_max ?? '',
    ].join(':');
  }

  private setCountCache(key: string, count: number): void {
    if (this.countCache.size >= MAX_CACHE_ENTRIES && !this.countCache.has(key)) {
      const firstKey = this.countCache.keys().next().value;
      if (firstKey !== undefined) this.countCache.delete(firstKey);
    }
    this.countCache.set(key, { count, expiresAt: Date.now() + COUNT_CACHE_TTL_MS });
  }
}
