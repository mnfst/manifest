import { PublicStatsService } from './public-stats.service';
import {
  ModelPricingCacheService,
  PricingEntry,
} from '../model-prices/model-pricing-cache.service';

function mockQueryBuilder(result: unknown) {
  const qb: Record<string, jest.Mock> = {};
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.limit = jest.fn().mockReturnValue(qb);
  qb.getRawOne = jest.fn().mockResolvedValue(result);
  qb.getRawMany = jest.fn().mockResolvedValue(result);
  return qb;
}

function makePricingEntry(overrides: Partial<PricingEntry> = {}): PricingEntry {
  return {
    model_name: 'test-model',
    provider: 'TestProvider',
    input_price_per_token: 0.000001,
    output_price_per_token: 0.000002,
    display_name: 'Test Model',
    ...overrides,
  };
}

describe('PublicStatsService', () => {
  let service: PublicStatsService;
  let mockRepo: { createQueryBuilder: jest.Mock };
  let mockPricingCache: { getAll: jest.Mock; getByModel: jest.Mock };

  beforeEach(() => {
    mockRepo = { createQueryBuilder: jest.fn() };
    mockPricingCache = {
      getAll: jest.fn().mockReturnValue([]),
      getByModel: jest.fn().mockReturnValue(null),
    };
    service = new PublicStatsService(
      mockRepo as never,
      mockPricingCache as unknown as ModelPricingCacheService,
    );
  });

  describe('getUsageStats', () => {
    function setupQueries(count: unknown, top: unknown, tokens: unknown) {
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder(count))
        .mockReturnValueOnce(mockQueryBuilder(top))
        .mockReturnValueOnce(mockQueryBuilder(tokens));
    }

    it('returns enriched top models with pricing and tokens_7d', async () => {
      setupQueries(
        { total: '42' },
        [{ model: 'gpt-4o', usage_count: '20' }],
        [{ model: 'gpt-4o', tokens: '5000000' }],
      );
      mockPricingCache.getByModel.mockReturnValue(
        makePricingEntry({
          provider: 'OpenAI',
          input_price_per_token: 0.0000025,
          output_price_per_token: 0.00001,
        }),
      );

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(42);
      expect(result.top_models[0]).toEqual({
        model: 'gpt-4o',
        provider: 'OpenAI',
        tokens_7d: 5000000,
        input_price_per_million: 2.5,
        output_price_per_million: 10,
        usage_rank: 1,
      });
      expect(result.token_map.get('gpt-4o')).toBe(5000000);
    });

    it('returns zeros when table is empty', async () => {
      setupQueries({ total: '0' }, [], []);

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
      expect(result.token_map.size).toBe(0);
    });

    it('handles null count result', async () => {
      setupQueries(null, [], []);
      expect((await service.getUsageStats()).total_messages).toBe(0);
    });

    it('handles undefined total property', async () => {
      setupQueries({}, [], []);
      expect((await service.getUsageStats()).total_messages).toBe(0);
    });

    it('uses Unknown provider when pricing has no match', async () => {
      setupQueries({ total: '1' }, [{ model: 'x', usage_count: '1' }], []);

      const result = await service.getUsageStats();

      expect(result.top_models[0].provider).toBe('Unknown');
      expect(result.top_models[0].input_price_per_million).toBeNull();
    });

    it('sets tokens_7d to 0 for models with no recent usage', async () => {
      setupQueries({ total: '5' }, [{ model: 'old', usage_count: '5' }], []);

      const result = await service.getUsageStats();

      expect(result.top_models[0].tokens_7d).toBe(0);
    });

    it('handles null tokens in token query', async () => {
      setupQueries(
        { total: '1' },
        [{ model: 'x', usage_count: '1' }],
        [{ model: 'x', tokens: null }],
      );

      const result = await service.getUsageStats();

      expect(result.token_map.get('x')).toBe(0);
    });

    it('applies 7-day cutoff to token query', async () => {
      const tokenQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder({ total: '0' }))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(tokenQb);

      await service.getUsageStats();

      expect(tokenQb.andWhere).toHaveBeenCalledWith(
        'at.timestamp >= :cutoff',
        expect.objectContaining({ cutoff: expect.any(String) }),
      );
    });

    it('assigns sequential usage_rank', async () => {
      setupQueries(
        { total: '10' },
        [
          { model: 'a', usage_count: '7' },
          { model: 'b', usage_count: '3' },
        ],
        [],
      );

      const result = await service.getUsageStats();

      expect(result.top_models[0].usage_rank).toBe(1);
      expect(result.top_models[1].usage_rank).toBe(2);
    });
  });

  describe('getFreeModels', () => {
    it('returns only free models with tokens_7d', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'free',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
        makePricingEntry({
          model_name: 'paid',
          input_price_per_token: 0.001,
          output_price_per_token: 0.002,
        }),
      ]);

      const result = service.getFreeModels(new Map([['free', 1000]]));

      expect(result).toEqual([{ model_name: 'free', provider: 'TestProvider', tokens_7d: 1000 }]);
    });

    it('treats null prices as free', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'n',
          input_price_per_token: null,
          output_price_per_token: null,
        }),
      ]);

      const result = service.getFreeModels(new Map());

      expect(result).toHaveLength(1);
      expect(result[0].tokens_7d).toBe(0);
    });

    it('excludes models with one non-zero price', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ input_price_per_token: 0, output_price_per_token: 0.001 }),
      ]);
      expect(service.getFreeModels(new Map())).toHaveLength(0);
    });

    it('returns empty when no free models', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ input_price_per_token: 0.001, output_price_per_token: 0.002 }),
      ]);
      expect(service.getFreeModels(new Map())).toEqual([]);
    });

    it('uses Unknown as provider fallback', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ provider: '', input_price_per_token: 0, output_price_per_token: 0 }),
      ]);
      expect(service.getFreeModels(new Map())[0].provider).toBe('Unknown');
    });
  });
});
