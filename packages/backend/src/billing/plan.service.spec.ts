import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import * as billingConfig from './billing.config';

describe('PlanService', () => {
  let service: PlanService;
  let mockTenantFindOne: jest.Mock;
  let mockAgentCount: jest.Mock;
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
    mockAgentCount = jest.fn().mockResolvedValue(0);
    mockQuery = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        { provide: getRepositoryToken(Tenant), useValue: { findOne: mockTenantFindOne } },
        { provide: getRepositoryToken(Agent), useValue: { count: mockAgentCount } },
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
      expect(await service.getLimits(CTX)).toEqual({ agents: null, requestsPerMonth: null });
    });

    it('returns free plan defaults', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      expect(await service.getLimits(CTX)).toEqual({ agents: 1, requestsPerMonth: 10_000 });
    });

    it('env var overrides plan default', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_AGENTS'] = '3';
      expect((await service.getLimits(CTX)).agents).toBe(3);
    });

    it('ignores a non-numeric env override', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_AGENTS'] = 'abc';
      expect((await service.getLimits(CTX)).agents).toBe(1);
    });

    it('tenant limit_overrides beats env and defaults', async () => {
      enableBilling();
      process.env['PLAN_LIMIT_FREE_AGENTS'] = '3';
      mockTenantFindOne.mockResolvedValue({ ...TENANT, limit_overrides: { agents: 50 } });
      expect((await service.getLimits(CTX)).agents).toBe(50);
    });

    it('returns pro defaults for pro tenants', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockQuery.mockResolvedValue([{ plan: 'pro' }]);
      expect(await service.getLimits(CTX)).toEqual({ agents: 10, requestsPerMonth: 500_000 });
    });
  });

  describe('countAgents', () => {
    it('returns 0 for a null tenantId without querying', async () => {
      expect(await service.countAgents(null)).toBe(0);
      expect(mockAgentCount).not.toHaveBeenCalled();
    });

    it('counts only live, non-playground agents of the tenant', async () => {
      mockAgentCount.mockResolvedValue(2);
      expect(await service.countAgents('t1')).toBe(2);
      expect(mockAgentCount).toHaveBeenCalledWith({
        where: { tenant_id: 't1', deleted_at: expect.anything(), is_playground: false },
      });
    });
  });

  describe('assertCanCreateAgent', () => {
    it('allows when billing is disabled regardless of count', async () => {
      mockAgentCount.mockResolvedValue(99);
      await expect(service.assertCanCreateAgent(CTX)).resolves.toBeUndefined();
    });

    it('allows a free tenant below the limit', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockAgentCount.mockResolvedValue(0);
      await expect(service.assertCanCreateAgent(CTX)).resolves.toBeUndefined();
    });

    it('throws 402 PLAN_LIMIT_AGENTS for a free tenant at the limit', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockAgentCount.mockResolvedValue(1);
      try {
        await service.assertCanCreateAgent(CTX);
        fail('expected HttpException');
      } catch (e) {
        const err = e as HttpException;
        expect(err.getStatus()).toBe(402);
        expect(err.getResponse()).toMatchObject({ code: 'PLAN_LIMIT_AGENTS', limit: 1, used: 1 });
      }
    });

    it('uses the plural form in the message when the limit is greater than one', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      process.env['PLAN_LIMIT_FREE_AGENTS'] = '2';
      mockAgentCount.mockResolvedValue(2);
      try {
        await service.assertCanCreateAgent(CTX);
        fail('expected HttpException');
      } catch (e) {
        const err = e as HttpException;
        const resp = err.getResponse() as { message: string };
        expect(resp.message).toContain('2 agents');
      }
    });
  });

  describe('getBillingStatus', () => {
    it('reports disabled with no Stripe call', async () => {
      const status = await service.getBillingStatus(CTX);
      expect(status.enabled).toBe(false);
      expect(status.agents.limit).toBeNull();
    });

    it('reports plan, usage and limits when enabled', async () => {
      enableBilling();
      mockTenantFindOne.mockResolvedValue(TENANT);
      mockAgentCount.mockResolvedValue(1);
      const status = await service.getBillingStatus(CTX);
      expect(status).toMatchObject({
        enabled: true,
        plan: 'free',
        agents: { used: 1, limit: 1 },
        requests: { used: null, limit: 10_000, periodEnd: null },
      });
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
});
