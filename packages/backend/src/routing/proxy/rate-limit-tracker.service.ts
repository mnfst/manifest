import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProviderRateLimit } from '../../entities/provider-rate-limit.entity';

/**
 * Parsed rate limit snapshot from a single provider response.
 */
export interface RateLimitSnapshot {
  userId: string;
  provider: string;
  authType: string;
  keyLabel?: string;
  limits: RateLimitEntry[];
}

export interface RateLimitEntry {
  limitType: string; // 'requests' | 'tokens' | 'input_tokens' | 'output_tokens'
  period: string; // 'minute' | 'hour' | 'day'
  limitValue: number | null;
  remainingValue: number | null;
  usedValue: number | null;
  resetsAt: string | null; // ISO timestamp
}

// In-memory cache: userId:provider -> latest snapshot
const TTL_MS = 60_000;
const MAX_CACHE = 2_000;

interface CachedSnapshot {
  data: RateLimitSnapshot;
  expiresAt: number;
}

const cache = new Map<string, CachedSnapshot>();

/**
 * Extract rate-limit headers from OpenAI and Anthropic responses.
 * Returns parsed entries or null if no rate-limit headers found.
 */
function extractRateLimitHeaders(headers: Headers, provider: string): RateLimitEntry[] | null {
  const entries: RateLimitEntry[] = [];
  const lower = provider.toLowerCase();

  if (lower === 'openai' || lower === 'chatgpt') {
    // OpenAI: x-ratelimit-limit-requests, x-ratelimit-remaining-requests, etc.
    const reqLimit = headers.get('x-ratelimit-limit-requests');
    const reqRemaining = headers.get('x-ratelimit-remaining-requests');
    const reqReset = headers.get('x-ratelimit-reset-requests');
    if (reqLimit || reqRemaining) {
      const limit = reqLimit ? parseInt(reqLimit, 10) : null;
      const remaining = reqRemaining ? parseInt(reqRemaining, 10) : null;
      entries.push({
        limitType: 'requests',
        period: 'minute',
        limitValue: limit,
        remainingValue: remaining,
        usedValue: limit != null && remaining != null ? limit - remaining : null,
        resetsAt: reqReset ? parseResetDuration(reqReset) : null,
      });
    }

    const tokLimit = headers.get('x-ratelimit-limit-tokens');
    const tokRemaining = headers.get('x-ratelimit-remaining-tokens');
    const tokReset = headers.get('x-ratelimit-reset-tokens');
    if (tokLimit || tokRemaining) {
      const limit = tokLimit ? parseInt(tokLimit, 10) : null;
      const remaining = tokRemaining ? parseInt(tokRemaining, 10) : null;
      entries.push({
        limitType: 'tokens',
        period: 'minute',
        limitValue: limit,
        remainingValue: remaining,
        usedValue: limit != null && remaining != null ? limit - remaining : null,
        resetsAt: tokReset ? parseResetDuration(tokReset) : null,
      });
    }
  }

  if (lower === 'anthropic') {
    // Anthropic: anthropic-ratelimit-requests-limit, etc.
    const reqLimit = headers.get('anthropic-ratelimit-requests-limit');
    const reqRemaining = headers.get('anthropic-ratelimit-requests-remaining');
    const reqReset = headers.get('anthropic-ratelimit-requests-reset');
    if (reqLimit || reqRemaining) {
      const limit = reqLimit ? parseInt(reqLimit, 10) : null;
      const remaining = reqRemaining ? parseInt(reqRemaining, 10) : null;
      entries.push({
        limitType: 'requests',
        period: 'minute',
        limitValue: limit,
        remainingValue: remaining,
        usedValue: limit != null && remaining != null ? limit - remaining : null,
        resetsAt: reqReset ?? null,
      });
    }

    const tokLimit = headers.get('anthropic-ratelimit-tokens-limit');
    const tokRemaining = headers.get('anthropic-ratelimit-tokens-remaining');
    const tokReset = headers.get('anthropic-ratelimit-tokens-reset');
    if (tokLimit || tokRemaining) {
      const limit = tokLimit ? parseInt(tokLimit, 10) : null;
      const remaining = tokRemaining ? parseInt(tokRemaining, 10) : null;
      entries.push({
        limitType: 'tokens',
        period: 'minute',
        limitValue: limit,
        remainingValue: remaining,
        usedValue: limit != null && remaining != null ? limit - remaining : null,
        resetsAt: tokReset ?? null,
      });
    }
  }

  return entries.length > 0 ? entries : null;
}

/**
 * Parse OpenAI reset duration strings like "6m32.512s" or "1h2m3s" to ISO timestamp.
 */
function parseResetDuration(raw: string): string | null {
  // Already an ISO timestamp
  if (raw.includes('T') || raw.includes('-')) return raw;

  let ms = 0;
  const hMatch = raw.match(/(\d+)h/);
  const mMatch = raw.match(/(\d+(?:\.\d+)?)m(?!s)/);
  const sMatch = raw.match(/(\d+(?:\.\d+)?)s/);
  const msMatch = raw.match(/(\d+)ms/);

  if (hMatch) ms += parseFloat(hMatch[1]) * 3600_000;
  if (mMatch) ms += parseFloat(mMatch[1]) * 60_000;
  if (sMatch) ms += parseFloat(sMatch[1]) * 1000;
  if (msMatch) ms += parseInt(msMatch[1], 10);

  if (ms === 0) return null;
  return new Date(Date.now() + ms).toISOString();
}

@Injectable()
export class RateLimitTrackerService {
  private readonly logger = new Logger(RateLimitTrackerService.name);

  constructor(
    @InjectRepository(ProviderRateLimit)
    private readonly rateLimitRepo: Repository<ProviderRateLimit>,
  ) {}

  /**
   * Fire-and-forget: extract rate limit headers from a provider response
   * and persist them. Errors never propagate to the proxy response path.
   */
  captureFromResponse(
    response: Response,
    userId: string,
    provider: string,
    authType: string,
    keyLabel?: string,
  ): void {
    try {
      const entries = extractRateLimitHeaders(response.headers, provider);
      if (!entries) return;

      const snapshot: RateLimitSnapshot = {
        userId,
        provider,
        authType,
        keyLabel,
        limits: entries,
      };

      // Update in-memory cache immediately
      const cacheKey = `${userId}:${provider}`;
      if (cache.size >= MAX_CACHE && !cache.has(cacheKey)) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
      cache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + TTL_MS });

      // Persist async (fire-and-forget)
      this.persistSnapshot(snapshot).catch(() => {
        // Silently ignore persistence errors
      });
    } catch {
      // Never propagate to proxy
    }
  }

  /**
   * Get the latest rate limit state for all providers of a user.
   */
  async getRateLimits(userId: string): Promise<RateLimitSnapshot[]> {
    // Check in-memory cache first
    const snapshots: RateLimitSnapshot[] = [];
    const uncachedProviders = new Set<string>();

    // Collect cached entries
    for (const [key, entry] of cache) {
      if (!key.startsWith(`${userId}:`)) continue;
      if (entry.expiresAt > Date.now()) {
        snapshots.push(entry.data);
      } else {
        cache.delete(key);
        uncachedProviders.add(key.split(':')[1]);
      }
    }

    // Fetch from DB for any that weren't cached
    const dbRows = await this.rateLimitRepo
      .createQueryBuilder('rl')
      .where('rl.user_id = :userId', { userId })
      .andWhere(
        'rl.captured_at = (SELECT MAX(rl2.captured_at) FROM provider_rate_limits rl2 WHERE rl2.user_id = rl.user_id AND rl2.provider = rl.provider AND rl2.limit_type = rl.limit_type)',
      )
      .getMany();

    // Group DB rows by provider
    const byProvider = new Map<string, ProviderRateLimit[]>();
    for (const row of dbRows) {
      const existing = byProvider.get(row.provider) ?? [];
      existing.push(row);
      byProvider.set(row.provider, existing);
    }

    // Build snapshots for uncached providers
    for (const [provider, rows] of byProvider) {
      const cacheKey = `${userId}:${provider}`;
      if (cache.has(cacheKey) && cache.get(cacheKey)!.expiresAt > Date.now()) continue;

      const snapshot: RateLimitSnapshot = {
        userId,
        provider,
        authType: rows[0].auth_type,
        keyLabel: rows[0].key_label ?? undefined,
        limits: rows.map((r) => ({
          limitType: r.limit_type,
          period: r.period,
          limitValue: r.limit_value ? parseInt(r.limit_value, 10) : null,
          remainingValue: r.remaining_value ? parseInt(r.remaining_value, 10) : null,
          usedValue: r.used_value ? parseInt(r.used_value, 10) : null,
          resetsAt: r.resets_at,
        })),
      };
      snapshots.push(snapshot);

      // Populate cache
      cache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + TTL_MS });
    }

    return snapshots;
  }

  private async persistSnapshot(snapshot: RateLimitSnapshot): Promise<void> {
    const now = new Date().toISOString();
    for (const entry of snapshot.limits) {
      const record = Object.assign(new ProviderRateLimit(), {
        id: randomUUID(),
        user_id: snapshot.userId,
        provider: snapshot.provider,
        auth_type: snapshot.authType,
        key_label: snapshot.keyLabel ?? null,
        limit_type: entry.limitType,
        period: entry.period,
        limit_value: entry.limitValue?.toString() ?? null,
        used_value: entry.usedValue?.toString() ?? '0',
        remaining_value: entry.remainingValue?.toString() ?? null,
        resets_at: entry.resetsAt,
        source: 'header',
        captured_at: now,
      });

      await this.rateLimitRepo.save(record);
    }
  }
}
