import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { PLAN_LIMITS, UNLIMITED_PLAN_LIMITS } from 'manifest-shared';
import type { BillingStatus, Plan, PlanLimits } from 'manifest-shared';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';
import { getStripeClient, isBillingEnabled } from './billing.config';

const PRICE_CACHE_TTL_MS = 60 * 60 * 1000;

function envLimit(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

@Injectable()
export class PlanService {
  private priceCache: { value: number | null; fetchedAt: number } | null = null;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
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
      agents: overrides?.agents ?? envLimit(`${prefix}_AGENTS`) ?? defaults.agents,
      requestsPerMonth:
        overrides?.requestsPerMonth ?? envLimit(`${prefix}_REQUESTS`) ?? defaults.requestsPerMonth,
    };
  }

  /** Live agents of the tenant; the reserved Playground agent never counts. */
  async countAgents(tenantId: string | null): Promise<number> {
    if (!tenantId) return 0;
    return this.agentRepo.count({
      where: { tenant_id: tenantId, deleted_at: IsNull(), is_playground: false },
    });
  }

  /** Keep existing, block new: only ever called at creation time. */
  async assertCanCreateAgent(ctx: TenantContext): Promise<void> {
    const limits = await this.getLimits(ctx);
    if (limits.agents === null) return;
    const used = await this.countAgents(ctx.tenantId);
    if (used < limits.agents) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'PLAN_LIMIT_AGENTS',
        message: `Your plan includes ${limits.agents} agent${limits.agents === 1 ? '' : 's'}. Upgrade to create more.`,
        limit: limits.agents,
        used,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async getBillingStatus(ctx: TenantContext): Promise<BillingStatus> {
    if (!isBillingEnabled()) {
      return {
        enabled: false,
        plan: 'free',
        priceMonthlyUsd: null,
        agents: { used: 0, limit: null },
        requests: { used: null, limit: null, periodEnd: null },
      };
    }
    const plan = await this.getPlan(ctx);
    const limits = await this.getLimits(ctx);
    const used = await this.countAgents(ctx.tenantId);
    return {
      enabled: true,
      plan,
      priceMonthlyUsd: await this.getProPriceUsd(),
      agents: { used, limit: limits.agents },
      requests: { used: null, limit: limits.requestsPerMonth, periodEnd: null },
    };
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
