import { Test, TestingModule } from '@nestjs/testing';
import { SavingsController } from './savings.controller';
import { SavingsQueryService } from '../services/savings-query.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ResolveAgentService } from '../../routing/routing-core/resolve-agent.service';

const SAMPLE_SAVINGS = {
  total_saved: 12.47,
  savings_pct: 67,
  actual_cost: 6.18,
  baseline_cost: 18.65,
  baseline_model: null,
  baseline_override_stale: false,
  request_count: 142,
  trend_pct: 15,
  is_auto: true,
  savings_by_auth_type: { api_key: 8.2, subscription: 3.5, local: 0.77 },
};

describe('SavingsController', () => {
  let controller: SavingsController;
  let mockGetSavings: jest.Mock;
  let mockGetCandidates: jest.Mock;
  let mockTenantResolve: jest.Mock;
  let mockResolveAgent: jest.Mock;

  let mockGetTimeseries: jest.Mock;

  beforeEach(async () => {
    mockGetSavings = jest.fn().mockResolvedValue(SAMPLE_SAVINGS);
    mockGetCandidates = jest.fn().mockResolvedValue([]);
    mockGetTimeseries = jest.fn().mockResolvedValue([]);
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');
    mockResolveAgent = jest.fn().mockResolvedValue({
      id: 'agent-uuid-1',
      savings_baseline_model: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsController],
      providers: [
        {
          provide: SavingsQueryService,
          useValue: {
            getSavings: mockGetSavings,
            getBaselineCandidates: mockGetCandidates,
            getSavingsTimeseries: mockGetTimeseries,
          },
        },
        { provide: TenantCacheService, useValue: { resolve: mockTenantResolve } },
        {
          provide: ResolveAgentService,
          useValue: { resolve: mockResolveAgent },
        },
      ],
    }).compile();

    controller = module.get<SavingsController>(SavingsController);
  });

  describe('GET /savings', () => {
    it('returns savings data in auto mode', async () => {
      const user = { id: 'u1' };
      const result = await controller.getSavings(
        { range: '30d', agent_name: 'bot-1' },
        user as never,
      );

      expect(result).toEqual(SAMPLE_SAVINGS);
      expect(mockGetSavings).toHaveBeenCalledWith('30d', 'u1', 'bot-1', 'tenant-123', undefined);
    });

    it('passes baseline override from query param', async () => {
      const user = { id: 'u1' };
      await controller.getSavings(
        { range: '30d', agent_name: 'bot-1', baseline: 'gpt-4o' },
        user as never,
      );

      expect(mockGetSavings).toHaveBeenCalledWith('30d', 'u1', 'bot-1', 'tenant-123', 'gpt-4o');
    });

    it('passes undefined tenantId when tenant not found', async () => {
      mockTenantResolve.mockResolvedValueOnce(null);
      const user = { id: 'u1' };
      await controller.getSavings({ range: '24h', agent_name: 'bot-1' }, user as never);

      expect(mockGetSavings).toHaveBeenCalledWith('24h', 'u1', 'bot-1', undefined, undefined);
    });
  });

  describe('GET /savings/timeseries', () => {
    it('returns timeseries data', async () => {
      const rows = [{ date: '2026-04-20', actual_cost: 1, baseline_cost: 2 }];
      mockGetTimeseries.mockResolvedValueOnce(rows);
      const user = { id: 'u1' };
      const result = await controller.getSavingsTimeseries(
        { range: '7d', agent_name: 'bot-1' },
        user as never,
      );
      expect(result).toEqual(rows);
      expect(mockGetTimeseries).toHaveBeenCalledWith('7d', 'u1', 'bot-1', 'tenant-123');
    });

    it('passes undefined tenantId when tenant not found', async () => {
      mockTenantResolve.mockResolvedValueOnce(null);
      const user = { id: 'u1' };
      await controller.getSavingsTimeseries({ range: '24h', agent_name: 'bot-1' }, user as never);
      expect(mockGetTimeseries).toHaveBeenCalledWith('24h', 'u1', 'bot-1', undefined);
    });
  });

  describe('GET /savings/baseline-candidates', () => {
    it('returns candidates for the agent', async () => {
      const user = { id: 'u1' };
      await controller.getBaselineCandidates('bot-1', user as never);

      expect(mockResolveAgent).toHaveBeenCalledWith('u1', 'bot-1');
      expect(mockGetCandidates).toHaveBeenCalledWith('agent-uuid-1', null);
    });
  });
});
