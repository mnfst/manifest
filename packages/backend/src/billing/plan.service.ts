import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PLAN_LIMITS, UNLIMITED_PLAN_LIMITS } from 'manifest-shared';
import type { BillingEmailPreferences, BillingStatus, Plan, PlanLimits } from 'manifest-shared';
import { Tenant } from '../entities/tenant.entity';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';
import { getStripeClient, isBillingEnabled } from './billing.config';
import {
  DEFAULT_BILLING_EMAIL_PREFERENCES,
  normalizeBillingEmailPreferences,
} from './billing-email-preferences';

const PRICE_CACHE_TTL_MS = 60 * 60 * 1000;
// Short TTL keeps the hot proxy path O(1) between refreshes. Staleness is
// bounded to this window: a tenant can slip at most ~TTL worth of requests past
// the cap before the next refresh blocks them (per process — multiple pods
// multiply that). Acceptable for a Free-tier gate; it only ever errs toward
// letting a few extra requests through, never toward false blocks.
const REQUEST_COUNT_CACHE_TTL_MS = 30 * 1000;
const MAX_REQUEST_COUNT_CACHE_SIZE = 10_000;
// Throttle the "count failed → failing open" warning: a sustained DB outage
// hits this on every proxied request, which would flood logs and add avoidable
// pressure to the hot path. One line per window, with a suppressed-count tail so
// the true rate stays visible.
const COUNT_FAILURE_WARN_WINDOW_MS = 60 * 1000;

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

/** Cached monthly request count for one tenant. Keyed by the UTC month it
 * covers so a month rollover invalidates naturally instead of serving last
 * month's total under this month's periodEnd. `pending` coalesces concurrent
 * misses (single-flight) so a burst can't stampede the DB with COUNT(*). */
interface RequestCountEntry {
  monthStartMs: number;
  count?: number;
  fetchedAt?: number;
  pending?: Promise<number>;
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);
  private priceCache: { value: number | null; fetchedAt: number } | null = null;
  private requestCountCache = new Map<string, RequestCountEntry>();
  private lastCountFailureWarnAtMs = 0;
  private suppressedCountFailureWarns = 0;

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
  private async resolveOwnerUserId(ctx: TenantContext): Promise<string | null> {
    if (ctx.tenantId) {
      const tenant = await this.tenantRepo.findOne({ where: { id: ctx.tenantId } });
      if (tenant?.owner_user_id) return tenant.owner_user_id;
    }
    return ctx.userId;
  }

  private async findTenant(ctx: TenantContext): Promise<Tenant | null> {
    if (!ctx.tenantId) return null;
    return this.tenantRepo.findOne({ where: { id: ctx.tenantId } });
  }

  /** Resolve the tenant's plan from better-auth's webhook-synced subscription table. */
  async getPlan(ctx: TenantContext): Promise<Plan> {
    if (!isBillingEnabled()) return 'free';
    const ownerId = await this.resolveOwnerUserId(ctx);
    if (!ownerId) return 'free';
    // Raw SQL is intentional: the subscription table is owned by better-auth
    // (no TypeORM entity), camelCase quoted columns.
    const rows: Array<{ plan: string }> = await this.dataSource.query(
      `SELECT "plan" FROM "subscription"
       WHERE "referenceId" = $1 AND "status" IN ('active', 'trialing')
       ORDER BY "periodEnd" DESC NULLS LAST
       LIMIT 1`,
      [ownerId],
    );
    return rows[0]?.plan === 'pro' ? 'pro' : 'free';
  }

  /** Resolution order: per-tenant override > instance env > plan defaults. */
  async getLimits(ctx: TenantContext): Promise<PlanLimits> {
    if (!isBillingEnabled()) return UNLIMITED_PLAN_LIMITS;
    const plan = await this.getPlan(ctx);
    const defaults = PLAN_LIMITS[plan];
    const prefix = `PLAN_LIMIT_${plan.toUpperCase()}`;
    const tenant = await this.findTenant(ctx);
    const overrides = tenant?.limit_overrides;
    return {
      requestsPerMonth:
        overrides?.requestsPerMonth ?? envLimit(`${prefix}_REQUESTS`) ?? defaults.requestsPerMonth,
    };
  }

  /** Start of the current calendar month in UTC (epoch ms). */
  private monthStartMsUtc(now: Date): number {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }

  /** Start of next calendar month in UTC — the moment the request quota resets. */
  private nextMonthStartUtc(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }

  /**
   * Routed requests recorded for the tenant since `monthStartMs`, cached per
   * tenant+month with single-flight coalescing. "Routed request" = one
   * non-superseded `agent_messages` row that does not belong to the tenant's
   * Playground agent:
   *  - `superseded = false` drops intermediate fallback attempts, which the
   *    recorder flags as rows that "must never count as a message" — otherwise
   *    a single fallback-heavy request would count 2-3×.
   *  - excluding Playground keeps the dashboard test tool from consuming (or
   *    being blocked by) the production request quota.
   */
  async countRequestsSince(tenantId: string | null, monthStartMs: number): Promise<number> {
    if (!tenantId) return 0;

    const cached = this.requestCountCache.get(tenantId);
    if (cached && cached.monthStartMs === monthStartMs) {
      if (cached.pending) return cached.pending;
      if (cached.count !== undefined && cached.fetchedAt !== undefined) {
        if (Date.now() - cached.fetchedAt < REQUEST_COUNT_CACHE_TTL_MS) return cached.count;
      }
    }

    const pending = this.dataSource
      .query(
        `SELECT COUNT(*)::int AS n
           FROM agent_messages m
          WHERE m.tenant_id = $1
            AND m.timestamp >= $2
            AND m.superseded = false
            AND NOT EXISTS (
              SELECT 1 FROM agents pa
               WHERE pa.id = m.agent_id AND pa.is_playground = true
            )`,
        [tenantId, new Date(monthStartMs).toISOString()],
      )
      .then((rows: Array<{ n: number }>) => {
        const count = rows[0]?.n ?? 0;
        this.requestCountCache.set(tenantId, { monthStartMs, count, fetchedAt: Date.now() });
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

    this.requestCountCache.set(tenantId, { monthStartMs, pending });
    return pending;
  }

  /** Routed requests for the tenant so far this calendar month (UTC), cached. */
  async countRequestsThisMonth(tenantId: string | null): Promise<number> {
    return this.countRequestsSince(tenantId, this.monthStartMsUtc(new Date()));
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

  /**
   * Block a routed request when the tenant is at/over its monthly request cap.
   * Called on the /v1/* proxy admission path BEFORE the request is recorded, so
   * a blocked request never becomes an `agent_messages` row (which would count
   * toward the very limit it hit). Only structured data is thrown; the friendly
   * copy + upgrade link is built in ProxyExceptionFilter.
   */
  async assertWithinRequestLimit(ctx: TenantContext): Promise<void> {
    if (!isBillingEnabled()) return;
    const limits = await this.getLimits(ctx);
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
    const emailPreferences = billingEnabled
      ? await this.getBillingEmailPreferences(ctx)
      : DEFAULT_BILLING_EMAIL_PREFERENCES;
    if (!billingEnabled) {
      return {
        enabled: false,
        plan: 'free',
        priceMonthlyUsd: null,
        emailPreferences,
        requests: { used: null, limit: null, periodEnd: null },
      };
    }
    const plan = await this.getPlan(ctx);
    const limits = await this.getLimits(ctx);
    // One `now` drives both the count window and the reset date so they can't
    // disagree across a midnight-UTC boundary.
    const now = new Date();
    const requestsUsed = await this.countRequestsSince(ctx.tenantId, this.monthStartMsUtc(now));
    return {
      enabled: true,
      plan,
      priceMonthlyUsd: await this.getProPriceUsd(),
      emailPreferences,
      requests: {
        used: requestsUsed,
        limit: limits.requestsPerMonth,
        periodEnd: this.nextMonthStartUtc(now).toISOString(),
      },
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
  private async getProPriceUsd(): Promise<number | null> {
    if (this.priceCache && Date.now() - this.priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
      return this.priceCache.value;
    }
    try {
      const price = await getStripeClient().prices.retrieve(process.env['STRIPE_PRO_PRICE_ID']!);
      const value = price.unit_amount != null ? price.unit_amount / 100 : null;
      this.priceCache = { value, fetchedAt: Date.now() };
      return value;
    } catch {
      this.priceCache = { value: null, fetchedAt: Date.now() };
      return null;
    }
  }
}
