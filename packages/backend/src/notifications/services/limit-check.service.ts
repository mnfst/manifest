import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService, formatNotificationTimestamp } from './notification-log.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { ManifestRuntimeService } from '../../common/services/manifest-runtime.service';
import { computePeriodBoundaries, computePeriodResetDate } from '../../common/utils/period.util';

interface BlockRule {
  id: string;
  tenant_id: string;
  agent_name: string;
  user_id: string;
  metric_type: 'tokens' | 'cost';
  threshold: number;
  period: 'hour' | 'day' | 'week' | 'month';
}

export interface LimitExceeded {
  ruleId: string;
  metricType: 'tokens' | 'cost';
  threshold: number;
  actual: number;
  period: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_SIZE = 10_000;

@Injectable()
export class LimitCheckService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LimitCheckService.name);
  private readonly rulesCache = new Map<string, CacheEntry<BlockRule[]>>();
  // Consumption is cached per-user (outer key) so an ingest event — which only
  // carries the userId of the agent that just wrote a message — can evict just
  // that user's buckets instead of nuking every tenant's cached consumption.
  // The inner key keeps the tenant/agent/metric/period granularity.
  private readonly consumptionCache = new Map<string, Map<string, CacheEntry<number>>>();
  private ingestSub?: Subscription;

  constructor(
    private readonly rulesService: NotificationRulesService,
    private readonly emailService: NotificationEmailService,
    private readonly emailProviderConfig: EmailProviderConfigService,
    private readonly ingestBus: IngestEventBusService,
    private readonly runtime: ManifestRuntimeService,
    private readonly notificationLog: NotificationLogService,
  ) {}

  onModuleInit(): void {
    this.ingestSub = this.ingestBus.all().subscribe((event) => {
      // Surgical eviction: only the writing user's consumption is now stale.
      // Other tenants' cached entries keep serving from cache for the TTL.
      this.consumptionCache.delete(event.userId);
    });
  }

  onModuleDestroy(): void {
    this.ingestSub?.unsubscribe();
  }

  async checkLimits(tenantId: string, agentName: string): Promise<LimitExceeded | null> {
    const rules = await this.getCachedRules(tenantId, agentName);
    if (rules.length === 0) return null;

    for (const rule of rules) {
      const { periodStart, periodEnd } = computePeriodBoundaries(rule.period);
      const actual = await this.getCachedConsumption(
        rule.user_id,
        tenantId,
        agentName,
        rule.metric_type,
        periodStart,
        periodEnd,
      );

      if (actual >= rule.threshold) {
        this.notifyLimitExceeded(rule, actual, periodStart, periodEnd).catch((err) => {
          this.logger.error(`Failed to send block notification for rule ${rule.id}: ${err}`);
        });

        return {
          ruleId: rule.id,
          metricType: rule.metric_type,
          threshold: rule.threshold,
          actual,
          period: rule.period,
        };
      }
    }

    return null;
  }

  invalidateCache(tenantId: string, agentName: string): void {
    const key = `${tenantId}:${agentName}`;
    this.rulesCache.delete(key);
    // Mutations arrive with tenant_id + agent_name (not userId), so sweep every
    // user bucket for inner entries scoped to this tenant/agent.
    const innerPrefix = key + ':';
    for (const [userId, inner] of this.consumptionCache) {
      for (const innerKey of inner.keys()) {
        if (innerKey.startsWith(innerPrefix)) inner.delete(innerKey);
      }
      if (inner.size === 0) this.consumptionCache.delete(userId);
    }
  }

  private async notifyLimitExceeded(
    rule: BlockRule,
    actual: number,
    periodStart: string,
    periodEnd: string,
  ): Promise<void> {
    if (await this.notificationLog.hasAlreadySent(rule.id, periodStart)) return;

    const now = formatNotificationTimestamp();
    const providerConfig = await this.emailProviderConfig.getFullConfig(rule.user_id);
    const email = await this.notificationLog.resolveUserEmail(
      rule.user_id,
      providerConfig?.notificationEmail,
    );
    await this.notificationLog.insertLog({
      ruleId: rule.id,
      periodStart,
      periodEnd,
      actualValue: actual,
      thresholdValue: rule.threshold,
      metricType: rule.metric_type,
      agentName: rule.agent_name,
      sentAt: now,
    });

    if (email) {
      await this.emailService.sendThresholdAlert(
        email,
        {
          agentName: rule.agent_name,
          metricType: rule.metric_type,
          threshold: rule.threshold,
          actualValue: actual,
          period: rule.period,
          timestamp: now,
          agentUrl: `${this.runtime.getAuthBaseUrl()}/agents/${encodeURIComponent(rule.agent_name)}`,
          alertType: 'hard',
          periodResetDate: computePeriodResetDate(rule.period),
        },
        providerConfig ?? undefined,
      );
    }
  }

  private async getCachedRules(tenantId: string, agentName: string): Promise<BlockRule[]> {
    const key = `${tenantId}:${agentName}`;
    const now = Date.now();
    const cached = this.rulesCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;

    this.evictExpired(this.rulesCache, now);
    this.evictOldestIfFull(this.rulesCache);
    const rules = await this.rulesService.getActiveBlockRules(tenantId, agentName);
    this.rulesCache.set(key, { data: rules, expiresAt: now + CACHE_TTL_MS });
    return rules;
  }

  private async getCachedConsumption(
    userId: string,
    tenantId: string,
    agentName: string,
    metricType: 'tokens' | 'cost',
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    const innerKey = `${tenantId}:${agentName}:${metricType}:${periodStart}`;
    const now = Date.now();
    const cached = this.consumptionCache.get(userId)?.get(innerKey);
    if (cached && cached.expiresAt > now) return cached.data;

    this.evictExpiredConsumption(now);
    this.evictOldestConsumptionIfFull();
    const actual = await this.rulesService.getConsumption(
      tenantId,
      agentName,
      metricType,
      periodStart,
      periodEnd,
    );
    let bucket = this.consumptionCache.get(userId);
    if (!bucket) {
      bucket = new Map<string, CacheEntry<number>>();
      this.consumptionCache.set(userId, bucket);
    }
    bucket.set(innerKey, { data: actual, expiresAt: now + CACHE_TTL_MS });
    return actual;
  }

  private evictExpired<T>(cache: Map<string, CacheEntry<T>>, now: number): void {
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }

  private evictOldestIfFull<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  private evictExpiredConsumption(now: number): void {
    for (const [userId, inner] of this.consumptionCache) {
      this.evictExpired(inner, now);
      if (inner.size === 0) this.consumptionCache.delete(userId);
    }
  }

  private evictOldestConsumptionIfFull(): void {
    let total = 0;
    for (const inner of this.consumptionCache.values()) total += inner.size;
    if (total < MAX_CACHE_SIZE) return;

    // total >= MAX_CACHE_SIZE guarantees the first bucket exists and is
    // non-empty (empty buckets are dropped eagerly elsewhere). Evict its oldest
    // inner entry, removing the bucket if that was its last entry.
    const [userId, inner] = this.consumptionCache.entries().next().value as [
      string,
      Map<string, CacheEntry<number>>,
    ];
    const firstInnerKey = inner.keys().next().value as string;
    inner.delete(firstInnerKey);
    if (inner.size === 0) this.consumptionCache.delete(userId);
  }
}
