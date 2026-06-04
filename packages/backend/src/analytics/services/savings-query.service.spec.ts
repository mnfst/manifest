import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavingsQueryService } from './savings-query.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { HeaderTier } from '../../entities/header-tier.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';

function mockQb(rows: Record<string, unknown>[] = []) {
  const qb: Record<string, jest.Mock> = {};
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.setParameters = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  qb.getRawOne = jest.fn().mockResolvedValue(rows[0] ?? null);
  qb.leftJoin = jest.fn().mockReturnValue(qb);
  return qb;
}

describe('SavingsQueryService', () => {
  let service: SavingsQueryService;
  let messageCreateQb: jest.Mock;
  let agentFindOne: jest.Mock;
  let providerFind: jest.Mock;
  let tierFind: jest.Mock;
  let specificityFind: jest.Mock;
  let headerTierFind: jest.Mock;

  beforeEach(async () => {
    const defaultQb = mockQb();
    messageCreateQb = jest.fn().mockReturnValue(defaultQb);
    agentFindOne = jest.fn().mockResolvedValue(null);
    providerFind = jest.fn().mockResolvedValue([]);
    tierFind = jest.fn().mockResolvedValue([]);
    specificityFind = jest.fn().mockResolvedValue([]);
    headerTierFind = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsQueryService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: messageCreateQb },
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: { findOne: agentFindOne, update: jest.fn() },
        },
        { provide: getRepositoryToken(UserProvider), useValue: { find: providerFind } },
        { provide: getRepositoryToken(TierAssignment), useValue: { find: tierFind } },
        {
          provide: getRepositoryToken(SpecificityAssignment),
          useValue: { find: specificityFind },
        },
        { provide: getRepositoryToken(HeaderTier), useValue: { find: headerTierFind } },
        { provide: ModelPricingCacheService, useValue: { getByModel: jest.fn() } },
      ],
    }).compile();

    service = module.get(SavingsQueryService);
  });

  it('exports SavingsResult and BaselineCandidate interfaces', async () => {
    const mod = await import('./savings-query.service');
    expect(mod.SavingsQueryService).toBeDefined();
  });

  describe('getSavingsTimeseries', () => {
    it('returns daily-bucketed rows for multi-day range', async () => {
      const rows = [
        { bucket: '2026-04-20', actual_cost: '1.5', baseline_cost: '3.0' },
        { bucket: '2026-04-21', actual_cost: '2.0', baseline_cost: '4.0' },
      ];
      messageCreateQb.mockReturnValue(mockQb(rows));

      const result = await service.getSavingsTimeseries('7d', 'user-1', 'bot-1', 'tenant-1');

      expect(result).toEqual([
        { date: '2026-04-20', actual_cost: 1.5, baseline_cost: 3 },
        { date: '2026-04-21', actual_cost: 2, baseline_cost: 4 },
      ]);
    });

    it('returns hourly-bucketed rows for 24h range', async () => {
      const rows = [{ bucket: '2026-04-20T10:00:00', actual_cost: '0.5', baseline_cost: '1.0' }];
      messageCreateQb.mockReturnValue(mockQb(rows));

      const result = await service.getSavingsTimeseries('24h', 'user-1', 'bot-1');

      expect(result).toEqual([{ hour: '2026-04-20T10:00:00', actual_cost: 0.5, baseline_cost: 1 }]);
    });

    it('returns empty array when no data', async () => {
      messageCreateQb.mockReturnValue(mockQb([]));

      const result = await service.getSavingsTimeseries('30d', 'user-1', 'bot-1');

      expect(result).toEqual([]);
    });

    it('uses fallback baseline when agent has providers', async () => {
      agentFindOne.mockResolvedValue({ id: 'a1', name: 'bot-1' });
      providerFind.mockResolvedValue([
        {
          is_active: true,
          cached_models: JSON.stringify([
            {
              id: 'gpt-4o',
              displayName: 'GPT-4o',
              provider: 'openai',
              inputPricePerToken: 0.005,
              outputPricePerToken: 0.015,
            },
          ]),
        },
      ]);
      const qb = mockQb([{ bucket: '2026-04-20', actual_cost: '1', baseline_cost: '2' }]);
      messageCreateQb.mockReturnValue(qb);

      await service.getSavingsTimeseries('7d', 'user-1', 'bot-1', 'tenant-1');

      // Should have called setParameters with fallback prices from the most expensive model
      expect(qb.setParameters).toHaveBeenCalled();
    });
  });

  describe('getSavings (auto)', () => {
    it('returns empty savings when no data', async () => {
      const qb = mockQb([
        {
          request_count: 0,
          actual_cost: '0',
          baseline_cost: '0',
          total_saved: '0',
          saved_api_key: '0',
          saved_subscription: '0',
          saved_local: '0',
        },
      ]);
      const prevQb = mockQb([{ prev_saved: '0' }]);
      messageCreateQb.mockReturnValueOnce(qb).mockReturnValueOnce(prevQb);

      const result = await service.getSavings('30d', 'user-1', 'bot-1');

      expect(result.is_auto).toBe(true);
      expect(result.total_saved).toBe(0);
      expect(result.savings_pct).toBe(0);
    });

    it('issues both the current and previous window queries and computes the trend', async () => {
      const qb = mockQb([
        {
          request_count: 4,
          actual_cost: '1',
          baseline_cost: '5',
          total_saved: '4',
          saved_api_key: '3',
          saved_subscription: '1',
          saved_local: '0',
        },
      ]);
      const prevQb = mockQb([{ prev_saved: '2' }]);
      messageCreateQb.mockReturnValueOnce(qb).mockReturnValueOnce(prevQb);

      const result = await service.getSavings('30d', 'user-1', 'bot-1');

      // Both windows were queried — the parallelization must not drop a call.
      expect(qb.getRawOne).toHaveBeenCalledTimes(1);
      expect(prevQb.getRawOne).toHaveBeenCalledTimes(1);
      // Result is unchanged vs the prior sequential implementation.
      expect(result.total_saved).toBe(4);
      expect(result.baseline_cost).toBe(5);
      expect(result.savings_pct).toBe(80);
      expect(result.savings_by_auth_type).toEqual({
        api_key: 3,
        subscription: 1,
        local: 0,
      });
      // trend_pct = (4 - 2) / 2 * 100 = 100
      expect(result.trend_pct).toBe(100);
    });
  });

  describe('getSavings (override)', () => {
    it('returns empty when agent not found', async () => {
      agentFindOne.mockResolvedValue(null);

      const result = await service.getSavings('30d', 'user-1', 'bot-1', undefined, 'gpt-4o');

      expect(result.total_saved).toBe(0);
      expect(result.is_auto).toBe(true);
    });

    it('returns empty when override model not found', async () => {
      agentFindOne.mockResolvedValue({ id: 'a1', name: 'bot-1' });
      providerFind.mockResolvedValue([]);
      // Mock getHistoricalModels - no matching model
      const histQb = mockQb([]);
      messageCreateQb.mockReturnValue(histQb);

      const result = await service.getSavings('30d', 'user-1', 'bot-1', 'tenant-1', 'nonexistent');

      expect(result.total_saved).toBe(0);
    });

    it('issues both window queries in parallel for a resolved override baseline', async () => {
      agentFindOne.mockResolvedValue({ id: 'a1', name: 'bot-1' });
      providerFind.mockResolvedValue([
        {
          is_active: true,
          cached_models: JSON.stringify([
            {
              id: 'gpt-4o',
              displayName: 'GPT-4o',
              provider: 'openai',
              inputPricePerToken: 0.005,
              outputPricePerToken: 0.015,
            },
          ]),
        },
      ]);
      const qb = mockQb([
        {
          request_count: 2,
          actual_cost: '1',
          baseline_cost: '3',
          total_saved: '2',
          saved_api_key: '2',
          saved_subscription: '0',
          saved_local: '0',
        },
      ]);
      const prevQb = mockQb([{ prev_saved: '1' }]);
      messageCreateQb.mockReturnValueOnce(qb).mockReturnValueOnce(prevQb);

      const result = await service.getSavings('30d', 'user-1', 'bot-1', 'tenant-1', 'gpt-4o');

      expect(qb.getRawOne).toHaveBeenCalledTimes(1);
      expect(prevQb.getRawOne).toHaveBeenCalledTimes(1);
      expect(result.is_auto).toBe(false);
      expect(result.baseline_model!.id).toBe('gpt-4o');
      expect(result.total_saved).toBe(2);
      expect(result.savings_pct).toBe(67); // round(2/3 * 100)
      // trend_pct = (2 - 1) / 1 * 100 = 100
      expect(result.trend_pct).toBe(100);
    });
  });

  describe('getBaselineCandidates', () => {
    it('returns empty when no providers', async () => {
      providerFind.mockResolvedValue([]);
      const histQb = mockQb([]);
      messageCreateQb.mockReturnValue(histQb);

      const result = await service.getBaselineCandidates('agent-1', null);

      expect(result).toEqual([]);
    });

    it('returns candidates from provider cached_models', async () => {
      providerFind.mockResolvedValue([
        {
          is_active: true,
          cached_models: JSON.stringify([
            {
              id: 'gpt-4o',
              displayName: 'GPT-4o',
              provider: 'openai',
              inputPricePerToken: 0.005,
              outputPricePerToken: 0.015,
            },
          ]),
        },
      ]);
      const histQb = mockQb([]);
      messageCreateQb.mockReturnValue(histQb);

      const result = await service.getBaselineCandidates('agent-1', null);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
      expect(result[0].display_name).toBe('GPT-4o');
    });

    it('skips models with zero or missing prices', async () => {
      providerFind.mockResolvedValue([
        {
          is_active: true,
          cached_models: JSON.stringify([
            {
              id: 'free-model',
              displayName: 'Free',
              provider: 'x',
              inputPricePerToken: 0,
              outputPricePerToken: 0,
            },
          ]),
        },
      ]);
      const histQb = mockQb([]);
      messageCreateQb.mockReturnValue(histQb);

      const result = await service.getBaselineCandidates('agent-1', null);

      expect(result).toEqual([]);
    });

    it('handles malformed cached_models gracefully', async () => {
      providerFind.mockResolvedValue([{ is_active: true, cached_models: 'not-json{' }]);
      const histQb = mockQb([]);
      messageCreateQb.mockReturnValue(histQb);

      const result = await service.getBaselineCandidates('agent-1', null);

      expect(result).toEqual([]);
    });

    it('deduplicates models across providers', async () => {
      const model = {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        provider: 'openai',
        inputPricePerToken: 0.005,
        outputPricePerToken: 0.015,
      };
      providerFind.mockResolvedValue([
        { is_active: true, cached_models: JSON.stringify([model]) },
        { is_active: true, cached_models: JSON.stringify([model]) },
      ]);
      const histQb = mockQb([]);
      messageCreateQb.mockReturnValue(histQb);

      const result = await service.getBaselineCandidates('agent-1', null);

      expect(result).toHaveLength(1);
    });
  });
});
