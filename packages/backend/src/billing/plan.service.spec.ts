import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { Tenant } from '../entities/tenant.entity';
import * as billingConfig from './billing.config';

describe('PlanService', () => {
  let service: PlanService;
  let mockTenantFindOne: jest.Mock;
  let mockQuery: jest.Mock;
  const saved = { ...process.env };
  const CTX = { tenantId: 't1', userId: 'u1' };
  const FRESH_CTX = { tenantId: null, userId: 'u1' };
  const TENANT = { id: 't1', owner_user_id: 'u1', limit_overrides: null };

  function enableBilling() {
    process.env['MANIFEST_MODE'] = 'cloud';
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_x';
    process.env['STRIPE_PRO_PRICE_ID'] = 'price_x';
  }

  beforeEach(async () => {
    process.env = { ...saved };
    jest.restoreAllMocks();
    mockTenantFindOne = jest.fn().mockResolvedValue(null);
    mockQuery = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        { provide: getRepositoryToken(Tenant), useValue: { findOne: mockTenantFindOne } },
        { provide: DataSource, useValue: { query: mockQuery } },
      ],
    }).compile();
    service = module.get(PlanService);
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  describe('getPlan', () => {
    it('returns free when billing is disabled', async () => {
      expect(await service.getPlan(CTX)).toBe('free');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('resolves the subscription via the tenant owner', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue({ ...TENANT, owner_user_id: 'owner-9' });
      mockQuery.mockResolvedValueOnce([{ plan: 'pro' }]);
      expect(await service.getPlan(CTX)).toBe('pro');
      expect(mockQuery.mock.calls[0][1]).toEqual(['owner-9']);
    });

    it('falls back to ctx.userId when there is no tenant yet', async () => {
      enableBilling();
      mockQuery.mockResolvedValueOnce([{ plan: 'pro' }]);
      expect(await service.getPlan(FRESH_CTX)).toBe('pro');
      expect(mockQuery.mock.calls[0][1]).toEqual(['u1']);
    });

    it('returns free when neither tenant owner nor userId exists', async () => {
      enableBilling();
      expect(await service.getPlan({ tenantId: null, userId: null })).toBe('free');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns free when no active subscription row exists', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      expect(await service.getPlan(CTX)).toBe('free');
    });
  });

  describe('getLimits', () => {
    it('returns unlimited when billing is disabled', async () => {
      expect(await service.getLimits(CTX)).toEqual({ requestsPerMonth: null });
    });

    it('returns free plan defaults', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      expect(await service.getLimits(CTX)).toEqual({ requestsPerMonth: 10_000 });
    });

    it('env var overrides plan default', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = '3000';
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(3000);
    });

    it('ignores a non-numeric env override', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = 'abc';
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(10_000);
    });

    it('tenant limit_overrides beats env and defaults', async () => {
      enableBilling();
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = '3000';
      mockTenantFindOne.mockResolvedValue({
        ...TENANT,
        limit_overrides: { requestsPerMonth: 50_000 },
      });
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(50_000);
    });

    it('returns pro defaults (unlimited) for pro tenants', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockQuery.mockResolvedValue([{ plan: 'pro' }]);
      expect(await service.getLimits(CTX)).toEqual({ requestsPerMonth: null });
    });
  });

  describe('getBillingStatus', () => {
    it('reports disabled with no Stripe call', async () => {
      const status = await service.getBillingStatus(CTX);
      expect(status.enabled).toBe(false);
      expect(status.requests.limit).toBeNull();
    });

    it('reports plan, usage and limits when enabled', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockQuery.mockImplementation((sql: string) =>
        sql.includes('agent_messages')
          ? Promise.resolve([{ n: 42 }])
          : Promise.resolve([{ plan: 'free' }]),
      );
      const status = await service.getBillingStatus(CTX);
      expect(status).toMatchObject({
        enabled: true,
        plan: 'free',
        requests: { used: 42, limit: 10_000 },
      });
      // periodEnd is the 1st of next month at midnight UTC.
      expect(status.requests.periodEnd).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
    });
  });

  describe('price lookup', () => {
    it('fetches, converts cents to dollars, and caches', async () => {
      enableBilling();
      const retrieve = jest.fn().mockResolvedValue({ unit_amount: 2000 });
      jest
        .spyOn(billingConfig, 'getStripeClient')
        .mockReturnValue({ prices: { retrieve } } as never);
      mockTenantFindOne.mockResolvedValue({ id: 't1', limit_overrides: null });

      const first = await service.getBillingStatus('u1' as never);
      const second = await service.getBillingStatus('u1' as never);
      expect(first.priceMonthlyUsd).toBe(20);
      expect(second.priceMonthlyUsd).toBe(20);
      expect(retrieve).toHaveBeenCalledTimes(1); // second call served from cache
    });

    it('returns null price when Stripe errors, without failing the endpoint', async () => {
      enableBilling();
      jest.spyOn(billingConfig, 'getStripeClient').mockReturnValue({
        prices: { retrieve: jest.fn().mockRejectedValue(new Error('down')) },
      } as never);
      mockTenantFindOne.mockResolvedValue({ id: 't1', limit_overrides: null });

      const status = await service.getBillingStatus('u1' as never);
      expect(status.enabled).toBe(true);
      expect(status.priceMonthlyUsd).toBeNull();
    });

    it('handles a price with no unit_amount', async () => {
      enableBilling();
      jest.spyOn(billingConfig, 'getStripeClient').mockReturnValue({
        prices: { retrieve: jest.fn().mockResolvedValue({ unit_amount: null }) },
      } as never);
      mockTenantFindOne.mockResolvedValue({ id: 't1', limit_overrides: null });

      expect((await service.getBillingStatus('u1' as never)).priceMonthlyUsd).toBeNull();
    });
  });

  describe('countRequestsSince', () => {
    const START = Date.UTC(2026, 6, 1); // 2026-07-01 UTC

    it('returns 0 for a null tenantId without querying', async () => {
      expect(await service.countRequestsSince(null, START)).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('counts via SQL and passes the tenant + month-start params', async () => {
      mockQuery.mockResolvedValue([{ n: 7 }]);
      expect(await service.countRequestsSince('t1', START)).toBe(7);
      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe('t1');
      expect(params[1]).toBe(new Date(START).toISOString());
    });

    it('caches within the TTL — a second call does not re-query', async () => {
      mockQuery.mockResolvedValue([{ n: 3 }]);
      await service.countRequestsSince('t1', START);
      await service.countRequestsSince('t1', START);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent misses into a single query (single-flight)', async () => {
      let resolve!: (v: Array<{ n: number }>) => void;
      mockQuery.mockReturnValue(new Promise((r) => (resolve = r)));
      const a = service.countRequestsSince('t1', START);
      const b = service.countRequestsSince('t1', START);
      resolve([{ n: 5 }]);
      expect(await a).toBe(5);
      expect(await b).toBe(5);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('re-queries when the month rolls over (different window)', async () => {
      mockQuery.mockResolvedValue([{ n: 1 }]);
      await service.countRequestsSince('t1', START);
      await service.countRequestsSince('t1', Date.UTC(2026, 7, 1)); // August
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('defaults a missing row to 0', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await service.countRequestsSince('t1', START)).toBe(0);
    });

    it('drops the pending entry and rethrows on a DB error (so the next call retries)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('boom'));
      await expect(service.countRequestsSince('t1', START)).rejects.toThrow('boom');
      mockQuery.mockResolvedValueOnce([{ n: 9 }]);
      expect(await service.countRequestsSince('t1', START)).toBe(9);
    });

    it('evicts the oldest entry once the cache exceeds its size cap', async () => {
      mockQuery.mockResolvedValue([{ n: 1 }]);
      // One distinct tenant per entry; the (cap + 1)th insert triggers eviction.
      for (let i = 0; i <= 10_000; i++) {
        await service.countRequestsSince(`t-${i}`, START);
      }
      // The very first tenant should have been evicted → its next read re-queries.
      const before = mockQuery.mock.calls.length;
      await service.countRequestsSince('t-0', START);
      expect(mockQuery.mock.calls.length).toBe(before + 1);
    });

    it('countRequestsThisMonth derives the current UTC month window', async () => {
      mockQuery.mockResolvedValue([{ n: 2 }]);
      expect(await service.countRequestsThisMonth('t1')).toBe(2);
      const monthStart = new Date(mockQuery.mock.calls[0][1][1]);
      expect(monthStart.getUTCDate()).toBe(1);
      expect(monthStart.getUTCHours()).toBe(0);
    });
  });

  describe('assertWithinRequestLimit', () => {
    // Route subscription lookups vs the request COUNT to the right mock result.
    function routeQuery(plan: string, count: number) {
      mockQuery.mockImplementation((sql: string) =>
        sql.includes('agent_messages')
          ? Promise.resolve([{ n: count }])
          : Promise.resolve([{ plan }]),
      );
    }

    it('allows when billing is disabled without counting', async () => {
      await expect(service.assertWithinRequestLimit(CTX)).resolves.toBeUndefined();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('allows an unlimited (pro) tenant without counting requests', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockQuery.mockResolvedValue([{ plan: 'pro' }]); // getPlan → pro → limit null
      await expect(service.assertWithinRequestLimit(CTX)).resolves.toBeUndefined();
      // Only the subscription lookup ran; no agent_messages COUNT.
      expect(mockQuery.mock.calls.every(([sql]) => !String(sql).includes('agent_messages'))).toBe(
        true,
      );
    });

    it('allows a free tenant below the request limit', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      routeQuery('free', 9_999);
      await expect(service.assertWithinRequestLimit(CTX)).resolves.toBeUndefined();
    });

    it('throws 402 PLAN_LIMIT_REQUESTS for a free tenant at the limit', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      routeQuery('free', 10_000);
      try {
        await service.assertWithinRequestLimit(CTX);
        fail('expected HttpException');
      } catch (e) {
        const err = e as HttpException;
        expect(err.getStatus()).toBe(402);
        expect(err.getResponse()).toMatchObject({
          code: 'PLAN_LIMIT_REQUESTS',
          limit: 10_000,
          used: 10_000,
        });
      }
    });

    it('fails open (allows the request) when the count query errors', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockQuery.mockImplementation((sql: string) =>
        sql.includes('agent_messages')
          ? Promise.reject(new Error('db down'))
          : Promise.resolve([{ plan: 'free' }]),
      );
      // A COUNT failure must never block: the soft Free-tier gate errs to "allow".
      await expect(service.assertWithinRequestLimit(CTX)).resolves.toBeUndefined();
    });

    it('throttles the fail-open warning and reports the suppressed count', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockQuery.mockImplementation((sql: string) =>
        sql.includes('agent_messages')
          ? Promise.reject(new Error('db down'))
          : Promise.resolve([{ plan: 'free' }]),
      );
      const warn = jest
        .spyOn((service as unknown as { logger: { warn: jest.Mock } }).logger, 'warn')
        .mockImplementation(() => undefined);
      const nowSpy = jest.spyOn(Date, 'now');
      try {
        nowSpy.mockReturnValue(1_000_000);
        await service.assertWithinRequestLimit(CTX); // first failure → warns once
        await service.assertWithinRequestLimit(CTX); // within window → suppressed
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).not.toContain('suppressed');

        nowSpy.mockReturnValue(1_000_000 + 61_000);
        await service.assertWithinRequestLimit(CTX); // window elapsed → warns with tail
        expect(warn).toHaveBeenCalledTimes(2);
        expect(String(warn.mock.calls[1][0])).toContain('1 more suppressed');
      } finally {
        nowSpy.mockRestore();
      }
    });
  });

  describe('envLimit hardening', () => {
    it('rejects hex and scientific notation, falling back to the plan default', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = '0x10';
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(10_000);
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = '1e3';
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(10_000);
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = ' 5 ';
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(10_000);
    });

    it('accepts a plain digits-only override', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_REQUESTS'] = '7000';
      expect((await service.getLimits(CTX)).requestsPerMonth).toBe(7000);
    });
  });
});
