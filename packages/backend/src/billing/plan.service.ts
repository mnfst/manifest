import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MANIFEST_ERROR_ORIGINS, PLAN_LIMITS, UNLIMITED_PLAN_LIMITS } from 'manifest-shared';
import type {
  BillingEmailPreferences,
  BillingPrice,
  BillingStatus,
  Plan,
  PlanLimits,
} from 'manifest-shared';
import type Stripe from 'stripe';
import { Tenant } from '../entities/tenant.entity';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';
import { toLocalSqlTimestamp } from '../common/utils/postgres-sql';
import { getStripeClient, isBillingEnabled } from './billing.config';
import {
  DEFAULT_BILLING_EMAIL_PREFERENCES,
  normalizeBillingEmailPreferences,
} from './billing-email-preferences';

const PRICE_CACHE_TTL_MS = 60 * 60 * 1000;
const BILLING_PRICE_UNAVAILABLE: BillingPrice = Object.freeze({
  amount: null,
  currency: null,
  interval: null,
});
// Short TTL keeps the hot proxy path O(1) between refreshes. Staleness is
// bounded to this window: a tenant can slip at most ~TTL worth of requests past
// the cap before the next refresh blocks them (per process — multiple pods
// multiply that). Acceptable for a Free-tier gate; it only ever errs toward
// letting a few extra requests through, never toward false blocks.
const REQUEST_COUNT_CACHE_TTL_MS = 30 * 1000;
const MAX_REQUEST_COUNT_CACHE_SIZE = 10_000;
const DEFAULT_REQUEST_QUOTA_RESET_AT = '2026-07-09T09:06:52Z';
const REQUEST_QUOTA_RESET_AT_ENV = 'PLAN_REQUEST_QUOTA_RESET_AT';
const MANIFEST_ERROR_ORIGIN_SQL_LIST = MANIFEST_ERROR_ORIGINS.map((origin) => `'${origin}'`).join(
  ', ',
);
// Throttle the "count failed → failing open" warning: a sustained DB outage
// hits this on every proxied request, which would flood logs and add avoidable
// pressure to the hot path. One line per window, with a suppressed-count tail so
// the true rate stays visible.
const COUNT_FAILURE_WARN_WINDOW_MS = 60 * 1000;
const LIMIT_FAILURE_WARN_WINDOW_MS = 60 * 1000;

function envLimit(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  // Digits only: plan limits are non-negative integers. `Number()` would also
  // accept hex (0x10), scientific (1e3), and whitespace-padded values, silently
  // producing an unexpected limit instead of falling back to the plan default.
  if (!/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function requestQuotaResetAtMs(): number {
  const raw = process.env[REQUEST_QUOTA_RESET_AT_ENV]?.trim() || DEFAULT_REQUEST_QUOTA_RESET_AT;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_REQUEST_QUOTA_RESET_AT);
}

/** Cached monthly request count for one tenant. Keyed by the effective quota
 * window start so a month rollover invalidates naturally instead of serving
 * last month's total under this month's periodEnd. `pending` coalesces concurrent
 * misses (single-flight) so a burst can't stampede the DB with COUNT(*). */
interface RequestCountEntry {
  windowStartMs: number;
  count?: number;
  fetchedAt?: number;
  pending?: Promise<number>;
}

interface BillingSnapshot {
  plan: Plan;
  limitOverrides: { requestsPerMonth?: number } | null;
  billingEmailPreferences: Partial<BillingEmailPreferences> | null;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
}

interface BillingSnapshotRow {
  subscriptionPlan: string | null;
  cancelAtPeriodEnd: boolean | null;
  periodEnd: string | null;
  limitOverrides: { requestsPerMonth?: number } | null;
  billingEmailPreferences: Partial<BillingEmailPreferences> | null;
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);
  private priceCache: { value: BillingPrice; fetchedAt: number } | null = null;
  private requestCountCache = new Map<string, RequestCountEntry>();
  private lastCountFailureWarnAtMs = 0;
  private suppressedCountFailureWarns = 0;
  private lastLimitFailureWarnAtMs = 0;
  private suppressedLimitFailureWarns = 0;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Billing attaches to the tenant. The Stripe subscription row is keyed by
   * referenceId = the tenant OWNER's user id (better-auth's plugin keys
   * checkout to the session user); fall back to ctx.userId for fresh
   * accounts that have no tenant yet.
   */
  private async getBillingSnapshot(ctx: TenantContext): Promise<BillingSnapshot> {
    if (!isBillingEnabled() || (!ctx.tenantId && !ctx.userId)) {
      return {
        plan: 'free',
        limitOverrides: null,
        billingEmailPreferences: null,
        cancelAtPeriodEnd: false,
        periodEnd: null,
      };
    }
    const rows: BillingSnapshotRow[] = await this.dataSource.query(
      `SELECT
          t."limit_overrides" AS "limitOverrides",
          t."billing_email_preferences" AS "billingEmailPreferences",
          s."plan" AS "subscriptionPlan",
          s."cancelAtPeriodEnd" AS "cancelAtPeriodEnd",
          s."periodEnd" AS "periodEnd"
         FROM (SELECT 1) seed
    LEFT JOIN "tenants" t
           ON t."id" = $1
    LEFT JOIN LATERAL (
          SELECT "plan", "cancelAtPeriodEnd", "periodEnd"
            FROM "subscription"
           WHERE "referenceId" = COALESCE(t."owner_user_id", $2)
             AND "status" IN ('active', 'trialing')
        ORDER BY "periodEnd" DESC NULLS LAST
           LIMIT 1
         ) s
           ON COALESCE(t."owner_user_id", $2) IS NOT NULL`,
      [ctx.tenantId, ctx.userId],
    );
    const row = rows[0];
    return {
      plan: row?.subscriptionPlan === 'pro' ? 'pro' : 'free',
      limitOverrides: row?.limitOverrides ?? null,
      billingEmailPreferences: row?.billingEmailPreferences ?? null,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      periodEnd: row?.periodEnd ?? null,
    };
  }

  private async findTenant(ctx: TenantContext): Promise<Tenant | null> {
    if (!ctx.tenantId) return null;
    return this.tenantRepo.findOne({ where: { id: ctx.tenantId } });
  }

  /** Resolve the tenant's plan from better-auth's webhook-synced subscription table. */
  async getPlan(ctx: TenantContext): Promise<Plan> {
    return (await this.getBillingSnapshot(ctx)).plan;
  }

  private limitsForSnapshot(snapshot: BillingSnapshot): PlanLimits {
    const defaults = PLAN_LIMITS[snapshot.plan];
    const prefix = `PLAN_LIMIT_${snapshot.plan.toUpperCase()}`;
    const overrides = snapshot.limitOverrides;
    return {
      requestsPerMonth:
        overrides?.requestsPerMonth ?? envLimit(`${prefix}_REQUESTS`) ?? defaults.requestsPerMonth,
    };
  }

  /** Resolution order: per-tenant override > instance env > plan defaults. */
  async getLimits(ctx: TenantContext, opts: { failOpen?: boolean } = {}): Promise<PlanLimits> {
    if (!isBillingEnabled()) return UNLIMITED_PLAN_LIMITS;
    try {
      return this.limitsForSnapshot(await this.getBillingSnapshot(ctx));
    } catch (err) {
      if (!opts.failOpen) throw err;
      this.warnLimitFailureThrottled(ctx.tenantId, err as Error);
      return UNLIMITED_PLAN_LIMITS;
    }
  }

  /** Start of the current calendar month in UTC (epoch ms). */
  private monthStartMsUtc(now: Date): number {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }

  /** Start of next calendar month in UTC — the moment the request quota resets. */
  private nextMonthStartUtc(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }

  private requestQuotaWindowStartMs(monthStartMs: number): number {
    return Math.max(monthStartMs, requestQuotaResetAtMs());
  }

  /**
   * Routed requests recorded for the tenant since the effective quota window
   * start, cached per tenant+window with single-flight coalescing. "Routed request" = one
   * explicit request with at least one provider attempt that does not belong to
   * the tenant's Playground agent. The unlinked-attempt term preserves exact
   * quota behavior while the online historical backfill is still running.
   *  - excluding Playground keeps the dashboard test tool from consuming (or
   *    being blocked by) the production request quota.
   */
  async countRequestsSince(tenantId: string | null, monthStartMs: number): Promise<number> {
    if (!tenantId) return 0;
    const windowStartMs = this.requestQuotaWindowStartMs(monthStartMs);

    const cached = this.requestCountCache.get(tenantId);
    if (cached && cached.windowStartMs === windowStartMs) {
      if (cached.pending) return cached.pending;
      if (cached.count !== undefined && cached.fetchedAt !== undefined) {
        if (Date.now() - cached.fetchedAt < REQUEST_COUNT_CACHE_TTL_MS) return cached.count;
      }
    }

    const pending = this.dataSource
      .query(
        `SELECT (
           SELECT COUNT(*)
           FROM requests r
           WHERE r.tenant_id = $1
             AND r.timestamp >= $2
             AND EXISTS (SELECT 1 FROM agent_messages pa WHERE pa.request_id = r.id)
             AND NOT EXISTS (
               SELECT 1 FROM agents a
               WHERE a.id = r.agent_id AND a.is_playground = true
             )
         ) + (
           SELECT COUNT(*)
           FROM agent_messages m
           WHERE m.tenant_id = $1
             AND m.timestamp >= $2
             AND m.request_id IS NULL
             AND m.superseded = false
             AND (m.error_origin IS NULL OR m.error_origin NOT IN (${MANIFEST_ERROR_ORIGIN_SQL_LIST}))
             AND NOT EXISTS (
               SELECT 1 FROM agents a
               WHERE a.id = m.agent_id AND a.is_playground = true
             )
         ) AS n`,
        [tenantId, toLocalSqlTimestamp(new Date(windowStartMs))],
      )
      .then((rows: Array<{ n: number }>) => {
        const count = Number(rows[0]?.n ?? 0);
        this.requestCountCache.set(tenantId, { windowStartMs, count, fetchedAt: Date.now() });
        this.evictRequestCountCache();
        return count;
      })
      .catch((err: Error) => {
        // On a DB error, drop the pending entry so the next call retries rather
        // than awaiting a rejected promise forever, then rethrow. Callers decide
        // how to handle it: the proxy gate (assertWithinRequestLimit) fails open
        // so a COUNT hiccup never blocks a request; getBillingStatus surfaces it.
        this.requestCountCache.delete(tenantId);
        throw err;
      });

    this.requestCountCache.set(tenantId, { windowStartMs, pending });
    return pending;
  }

  /** Routed requests for the tenant so far this calendar month (UTC), cached. */
  async countRequestsThisMonth(tenantId: string | null): Promise<number> {
    return this.countRequestsSince(tenantId, this.monthStartMsUtc(new Date()));
  }

  /** Drop the cached request count so the next countRequestsSince() hits the DB. */
  invalidateRequestCountCache(tenantId: string): void {
    this.requestCountCache.delete(tenantId);
  }

  private evictRequestCountCache(): void {
    while (this.requestCountCache.size > MAX_REQUEST_COUNT_CACHE_SIZE) {
      const firstKey = this.requestCountCache.keys().next().value;
      if (firstKey === undefined) break;
      this.requestCountCache.delete(firstKey);
    }
  }

  /**
   * Log the fail-open warning at most once per {@link COUNT_FAILURE_WARN_WINDOW_MS},
   * carrying a count of how many were suppressed since the last emit. Keeps a
   * DB outage from turning every proxied request into a log line while still
   * surfacing the true failure rate.
   */
  private warnCountFailureThrottled(tenantId: string | null, err: Error): void {
    const now = Date.now();
    if (now - this.lastCountFailureWarnAtMs < COUNT_FAILURE_WARN_WINDOW_MS) {
      this.suppressedCountFailureWarns++;
      return;
    }
    const suppressed = this.suppressedCountFailureWarns;
    this.suppressedCountFailureWarns = 0;
    this.lastCountFailureWarnAtMs = now;
    const tail =
      suppressed > 0
        ? ` (${suppressed} more suppressed in the last ${COUNT_FAILURE_WARN_WINDOW_MS / 1000}s)`
        : '';
    this.logger.warn(
      `Request-limit count failed for tenant ${tenantId}; allowing request: ${err.message}${tail}`,
    );
  }

  private warnLimitFailureThrottled(tenantId: string | null, err: Error): void {
    const now = Date.now();
    if (now - this.lastLimitFailureWarnAtMs < LIMIT_FAILURE_WARN_WINDOW_MS) {
      this.suppressedLimitFailureWarns++;
      return;
    }
    const suppressed = this.suppressedLimitFailureWarns;
    this.suppressedLimitFailureWarns = 0;
    this.lastLimitFailureWarnAtMs = now;
    const tail =
      suppressed > 0
        ? ` (${suppressed} more suppressed in the last ${LIMIT_FAILURE_WARN_WINDOW_MS / 1000}s)`
        : '';
    this.logger.warn(
      `Request-limit lookup failed for tenant ${tenantId}; allowing request: ${err.message}${tail}`,
    );
  }

  /**
   * Block a routed request when the tenant is at/over its monthly request cap.
   * Called on the /v1/* proxy admission path BEFORE the request is recorded, so
   * a blocked request never becomes an `agent_messages` row (which would count
   * toward the very limit it hit). Only structured data is thrown; the friendly
   * copy + upgrade link is built in ProxyExceptionFilter.
   */
  async assertWithinRequestLimit(ctx: TenantContext): Promise<void> {
    if (!isBillingEnabled()) return;
    const limits = await this.getLimits(ctx, { failOpen: true });
    if (limits.requestsPerMonth === null) return; // Pro / unlimited
    let used: number;
    try {
      used = await this.countRequestsThisMonth(ctx.tenantId);
    } catch (err) {
      // Fail open: a transient COUNT failure must never block a request. The
      // limit is a soft Free-tier gate, not a hard financial guard, so erring
      // toward "allow" is correct. The next request retries the count. Warn is
      // throttled so a sustained outage can't flood the log / hot path.
      this.warnCountFailureThrottled(ctx.tenantId, err as Error);
      return;
    }
    if (used < limits.requestsPerMonth) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'PLAN_LIMIT_REQUESTS',
        limit: limits.requestsPerMonth,
        used,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async getBillingStatus(ctx: TenantContext): Promise<BillingStatus> {
    const billingEnabled = isBillingEnabled();
    if (!billingEnabled) {
      return {
        enabled: false,
        plan: 'free',
        priceMonthly: BILLING_PRICE_UNAVAILABLE,
        emailPreferences: DEFAULT_BILLING_EMAIL_PREFERENCES,
        requests: { used: null, limit: null, periodEnd: null },
        cancelAtPeriodEnd: false,
        subscriptionPeriodEnd: null,
      };
    }
    const snapshot = await this.getBillingSnapshot(ctx);
    const limits = this.limitsForSnapshot(snapshot);
    const emailPreferences = normalizeBillingEmailPreferences(snapshot.billingEmailPreferences);
    const now = new Date();
    const requestsUsed = await this.countRequestsSince(ctx.tenantId, this.monthStartMsUtc(now));
    return {
      enabled: true,
      plan: snapshot.plan,
      priceMonthly: await this.getProPrice(),
      emailPreferences,
      requests: {
        used: requestsUsed,
        limit: limits.requestsPerMonth,
        periodEnd: this.nextMonthStartUtc(now).toISOString(),
      },
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      subscriptionPeriodEnd: snapshot.periodEnd,
    };
  }

  async getBillingEmailPreferences(ctx: TenantContext): Promise<BillingEmailPreferences> {
    if (!ctx.tenantId) return DEFAULT_BILLING_EMAIL_PREFERENCES;
    const tenant = await this.findTenant(ctx);
    return normalizeBillingEmailPreferences(tenant?.billing_email_preferences);
  }

  async updateBillingEmailPreferences(
    ctx: TenantContext,
    preferences: BillingEmailPreferences,
  ): Promise<BillingEmailPreferences> {
    if (!ctx.tenantId) {
      throw new BadRequestException('A workspace is required to update billing email preferences.');
    }
    const normalized = normalizeBillingEmailPreferences(preferences);
    await this.tenantRepo.update({ id: ctx.tenantId }, { billing_email_preferences: normalized });
    return normalized;
  }

  /** Display price for the Pro plan, cached; never lets a Stripe outage break the endpoint. */
  private async getProPrice(): Promise<BillingPrice> {
    if (this.priceCache && Date.now() - this.priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
      return this.priceCache.value;
    }
    try {
      const price = await getStripeClient().prices.retrieve(process.env['STRIPE_PRO_PRICE_ID']!);
      const value = this.stripePriceToBillingPrice(price);
      this.priceCache = { value, fetchedAt: Date.now() };
      return value;
    } catch {
      this.priceCache = { value: BILLING_PRICE_UNAVAILABLE, fetchedAt: Date.now() };
      return BILLING_PRICE_UNAVAILABLE;
    }
  }

  private stripePriceToBillingPrice(price: Stripe.Price): BillingPrice {
    const rawAmount =
      price.unit_amount_decimal ?? (price.unit_amount != null ? String(price.unit_amount) : null);
    const minorAmount = rawAmount != null ? Number(rawAmount) : null;
    return {
      amount:
        minorAmount != null && Number.isFinite(minorAmount)
          ? minorAmount / this.currencyMinorUnitDivisor(price.currency)
          : null,
      currency: price.currency ? price.currency.toUpperCase() : null,
      interval: price.recurring?.interval ?? null,
    };
  }

  private currencyMinorUnitDivisor(currency: string): number {
    try {
      const digits =
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).resolvedOptions().maximumFractionDigits ?? 2;
      return 10 ** digits;
    } catch {
      return 100;
    }
  }
}
