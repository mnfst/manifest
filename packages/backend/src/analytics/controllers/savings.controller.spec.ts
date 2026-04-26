import { Test, TestingModule } from '@nestjs/testing';
import { SavingsController } from './savings.controller';
import { SavingsQueryService } from '../services/savings-query.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ResolveAgentService } from '../../routing/routing-core/resolve-agent.service';
import { NotFoundException } from '@nestjs/common';

const EMPTY_SAVINGS = {
  total_saved: 0,
  savings_pct: 0,
  actual_cost: 0,
  baseline_cost: 0,
  baseline_model: null,
  baseline_override_stale: false,
  request_count: 0,
  trend_pct: 0,
  savings_by_auth_type: { api_key: 0, subscription: 0, local: 0 },
};

const SAMPLE_SAVINGS = {
  total_saved: 12.47,
  savings_pct: 67,
  actual_cost: 6.18,
  baseline_cost: 18.65,
  baseline_model: {
    id: 'claude-sonnet-4-5',
    display_name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    input_price_per_token: 0.000003,
    output_price_per_token: 0.000015,
  },
  baseline_override_stale: false,
  request_count: 142,
  trend_pct: 15,
  savings_by_auth_type: { api_key: 8.2, subscription: 3.5, local: 0.77 },
};

describe('SavingsController', () => {
  let controller: SavingsController;
  let mockGetSavings: jest.Mock;
  let mockUpdateBaseline: jest.Mock;
  let mockGetCandidates: jest.Mock;
  let mockTenantResolve: jest.Mock;
  let mockResolveAgent: jest.Mock;
  let mockInvalidate: jest.Mock;

  beforeEach(async () => {
    mockGetSavings = jest.fn().mockResolvedValue(SAMPLE_SAVINGS);
    mockUpdateBaseline = jest.fn().mockResolvedValue(undefined);
    mockGetCandidates = jest.fn().mockResolvedValue([]);
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');
    mockResolveAgent = jest.fn().mockResolvedValue({
      id: 'agent-uuid-1',
      savings_baseline_model: null,
    });
    mockInvalidate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsController],
      providers: [
        {
          provide: SavingsQueryService,
          useValue: {
            getSavings: mockGetSavings,
            updateBaseline: mockUpdateBaseline,
            getBaselineCandidates: mockGetCandidates,
          },
        },
        { provide: TenantCacheService, useValue: { resolve: mockTenantResolve } },
        {
          provide: ResolveAgentService,
          useValue: { resolve: mockResolveAgent, invalidate: mockInvalidate },
        },
      ],
    }).compile();

    controller = module.get<SavingsController>(SavingsController);
  });

  describe('GET /savings', () => {
    it('returns savings data for a valid query', async () => {
      const user = { id: 'u1' };
      const result = await controller.getSavings(
        { range: '30d', agent_name: 'bot-1' },
        user as never,
      );

      expect(result).toEqual(SAMPLE_SAVINGS);
      expect(mockGetSavings).toHaveBeenCalledWith('30d', 'u1', 'bot-1', 'tenant-123');
    });

    it('passes undefined tenantId when tenant not found', async () => {
      mockTenantResolve.mockResolvedValueOnce(null);
      const user = { id: 'u1' };
      await controller.getSavings({ range: '24h', agent_name: 'bot-1' }, user as never);

      expect(mockGetSavings).toHaveBeenCalledWith('24h', 'u1', 'bot-1', undefined);
    });
  });

  describe('PUT /savings/baseline', () => {
    it('updates baseline and returns refreshed savings', async () => {
      const user = { id: 'u1' };
      const result = await controller.updateBaseline(
        { agent_name: 'bot-1', model_id: 'gpt-4o' },
        user as never,
      );

      expect(mockResolveAgent).toHaveBeenCalledWith('u1', 'bot-1');
      expect(mockUpdateBaseline).toHaveBeenCalledWith('agent-uuid-1', 'gpt-4o');
      expect(mockInvalidate).toHaveBeenCalledWith('tenant-123', 'bot-1');
      expect(result).toEqual(SAMPLE_SAVINGS);
    });

    it('resets baseline when model_id is null', async () => {
      const user = { id: 'u1' };
      await controller.updateBaseline({ agent_name: 'bot-1', model_id: null }, user as never);

      expect(mockUpdateBaseline).toHaveBeenCalledWith('agent-uuid-1', null);
    });

    it('throws NotFoundException for wrong tenant agent', async () => {
      mockResolveAgent.mockRejectedValueOnce(new NotFoundException());
      const user = { id: 'u1' };

      await expect(
        controller.updateBaseline({ agent_name: 'other-agent', model_id: 'gpt-4o' }, user as never),
      ).rejects.toThrow(NotFoundException);
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
