import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Subscription } from 'rxjs';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { computePeriodBoundaries } from '../../common/utils/period.util';
import { detectDialect, portableSql, type DbDialect } from '../../common/utils/sql-dialect';
import { LOCAL_EMAIL, readLocalNotificationEmail } from '../../common/constants/local-mode.constants';

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

@Injectable()
export class LimitCheckService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LimitCheckService.name);
  private readonly dialect: DbDialect;
  private readonly rulesCache = new Map<string, CacheEntry<BlockRule[]>>();
  private readonly consumptionCache = new Map<string, CacheEntry<number>>();
  private ingestSub?: Subscription;

  constructor(
    private readonly ds: DataSource,
    private readonly rulesService: NotificationRulesService,
    private readonly emailService: NotificationEmailService,
    private readonly emailProviderConfig: EmailProviderConfigService,
    private readonly ingestBus: IngestEventBusService,
  ) {
    this.dialect = detectDialect(ds.options.type as string);
  }

  onModuleInit(): void {
    this.ingestSub = this.ingestBus.all().subscribe(() => {
      this.consumptionCache.clear();
    });
  }

  onModuleDestroy(): void {
    this.ingestSub?.unsubscribe();
  }

  private sql(query: string): string {
    return portableSql(query, this.dialect);
  }

  async checkLimits(tenantId: string, agentName: string): Promise<LimitExceeded | null> {
    const rules = await this.getCachedRules(tenantId, agentName);
    if (rules.length === 0) return null;

    for (const rule of rules) {
      const { periodStart, periodEnd } = computePeriodBoundaries(rule.period);
      const actual = await this.getCachedConsumption(
        tenantId, agentName, rule.metric_type, periodStart, periodEnd,
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
    for (const k of this.consumptionCache.keys()) {
      if (k.startsWith(key + ':')) {
        this.consumptionCache.delete(k);
      }
    }
  }

  /** Send email + log (once per rule per period, fire-and-forget). */
  private async notifyLimitExceeded(
    rule: BlockRule, actual: number,
    periodStart: string, periodEnd: string,
  ): Promise<void> {
    const alreadySent = await this.ds.query(
      this.sql(`SELECT 1 FROM notification_logs WHERE rule_id = $1 AND period_start = $2`),
      [rule.id, periodStart],
    );
    if (alreadySent.length > 0) return;

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    const providerConfig = await this.emailProviderConfig.getFullConfig(rule.user_id);
    const email = await this.resolveUserEmail(rule.user_id, providerConfig);
    let emailSent = false;

    if (email) {
      emailSent = await this.emailService.sendThresholdAlert(
        email,
        {
          agentName: rule.agent_name,
          metricType: rule.metric_type,
          threshold: rule.threshold,
          actualValue: actual,
          period: rule.period,
          timestamp: now,
        },
        providerConfig ?? undefined,
      );
    }

    if (emailSent || !email) {
      await this.ds.query(
        this.sql(
          `INSERT INTO notification_logs
           (id, rule_id, period_start, period_end, actual_value, threshold_value, metric_type, agent_name, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        ),
        [uuid(), rule.id, periodStart, periodEnd, actual, rule.threshold,
         rule.metric_type, rule.agent_name, now],
      );
    }
  }

  private async resolveUserEmail(
    userId: string,
    fullConfig?: { notificationEmail?: string | null } | null,
  ): Promise<string | null> {
    if (fullConfig?.notificationEmail) return fullConfig.notificationEmail;

    if (process.env['MANIFEST_MODE'] === 'local') {
      const configEmail = readLocalNotificationEmail();
      if (configEmail) return configEmail;
    }

    const rows = await this.ds.query(
      this.sql(`SELECT email FROM "user" WHERE id = $1`),
      [userId],
    );
    const email = rows[0]?.email ?? null;
    if (email === LOCAL_EMAIL) return null;
    return email;
  }

  private async getCachedRules(tenantId: string, agentName: string): Promise<BlockRule[]> {
    const key = `${tenantId}:${agentName}`;
    const now = Date.now();
    const cached = this.rulesCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;

    this.evictExpired(this.rulesCache, now);
    const rules = await this.rulesService.getActiveBlockRules(tenantId, agentName);
    this.rulesCache.set(key, { data: rules, expiresAt: now + CACHE_TTL_MS });
    return rules;
  }

  private async getCachedConsumption(
    tenantId: string, agentName: string,
    metricType: 'tokens' | 'cost',
    periodStart: string, periodEnd: string,
  ): Promise<number> {
    const key = `${tenantId}:${agentName}:${metricType}:${periodStart}`;
    const now = Date.now();
    const cached = this.consumptionCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;

    this.evictExpired(this.consumptionCache, now);
    const actual = await this.rulesService.getConsumption(
      tenantId, agentName, metricType, periodStart, periodEnd,
    );
    this.consumptionCache.set(key, { data: actual, expiresAt: now + CACHE_TTL_MS });
    return actual;
  }

  private evictExpired<T>(cache: Map<string, CacheEntry<T>>, now: number): void {
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }
}
