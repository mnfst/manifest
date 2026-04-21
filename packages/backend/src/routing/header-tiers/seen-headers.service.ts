import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

export interface SeenHeader {
  key: string;
  count: number;
  top_values: string[];
  sdks: string[];
}

interface CachedEntry {
  data: SeenHeader[];
  expiresAt: number;
}

const TTL_MS = 5 * 60_000; // 5 minutes
const MAX_ENTRIES = 200;
const WINDOW_DAYS = 7;
const MAX_KEYS = 50;
const MAX_VALUES_PER_KEY = 3;

@Injectable()
export class SeenHeadersService {
  private readonly cache = new Map<string, CachedEntry>();

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async getSeenHeaders(userId: string, agentName?: string): Promise<SeenHeader[]> {
    const tenantId = await this.tenantCache.resolve(userId);
    const cacheKey = `${tenantId ?? 'user:' + userId}|${agentName ?? '*'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    // Raw SQL: expand request_headers (stored as simple-json text) into rows,
    // aggregate per key. Tenant- or user-scoped; optional agent filter.
    const filters: string[] = [
      `at.request_headers IS NOT NULL`,
      `at.timestamp > NOW() - INTERVAL '${WINDOW_DAYS} days'`,
    ];
    const params: unknown[] = [];
    if (tenantId) {
      params.push(tenantId);
      filters.push(`at.tenant_id = $${params.length}`);
    } else {
      params.push(userId);
      filters.push(`at.user_id = $${params.length}`);
    }
    if (agentName) {
      params.push(agentName);
      filters.push(`at.agent_name = $${params.length}`);
    }

    // Two-level aggregation so top_values is ordered by *frequency*, not just
    // a distinct slice. Inner query counts (key, value) pairs; outer groups by
    // key and picks the top N values per key by count.
    const sql = `
      WITH expanded AS (
        SELECT hdr.key, hdr.value, (at.caller_attribution::json->>'sdk') AS sdk
        FROM agent_messages at,
             LATERAL jsonb_each_text(at.request_headers::jsonb) AS hdr(key, value)
        WHERE ${filters.join(' AND ')}
      ),
      value_freq AS (
        SELECT key, value, COUNT(*)::int AS freq
        FROM expanded
        GROUP BY key, value
      ),
      ranked_values AS (
        SELECT key, value, freq,
               ROW_NUMBER() OVER (PARTITION BY key ORDER BY freq DESC, value ASC) AS rn
        FROM value_freq
      )
      SELECT
        key,
        (SELECT SUM(freq)::int FROM value_freq v WHERE v.key = r.key) AS count,
        (SELECT array_agg(value ORDER BY rn)
         FROM ranked_values rv
         WHERE rv.key = r.key AND rv.rn <= ${MAX_VALUES_PER_KEY}) AS top_values,
        (SELECT array_remove(array_agg(DISTINCT sdk), NULL)
         FROM expanded e WHERE e.key = r.key) AS sdks
      FROM ranked_values r
      WHERE r.rn = 1
      ORDER BY count DESC
      LIMIT ${MAX_KEYS}
    `;

    type Row = { key: string; count: number; top_values: string[]; sdks: string[] | null };
    const rows = (await this.messageRepo.query(sql, params)) as Row[];

    const data: SeenHeader[] = rows.map((r) => ({
      key: r.key,
      count: r.count,
      top_values: r.top_values ?? [],
      sdks: r.sdks ?? [],
    }));

    this.putCache(cacheKey, data);
    return data;
  }

  private putCache(key: string, data: SeenHeader[]): void {
    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
  }
}
