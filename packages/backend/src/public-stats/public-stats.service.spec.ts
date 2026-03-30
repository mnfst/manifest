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
    context_window: 128000,
    ...overrides,
  };
}

describe('PublicStatsService', () => {
  let service: PublicStatsService;
  let mockRepo: { createQueryBuilder: jest.Mock };
  let mockPricingCache: { getAll: jest.Mock };

  beforeEach(() => {
    mockRepo = { createQueryBuilder: jest.fn() };
    mockPricingCache = { getAll: jest.fn().mockReturnValue([]) };
    service = new PublicStatsService(
      mockRepo as never,
      mockPricingCache as unknown as ModelPricingCacheService,
    );
  });

  describe('getUsageStats', () => {
    it('returns total message count and top models', async () => {
      const countQb = mockQueryBuilder({ total: '42' });
      const topQb = mockQueryBuilder([
        { model: 'gpt-4o', usage_count: '20' },
        { model: 'claude-opus-4-6', usage_count: '15' },
      ]);
      mockRepo.createQueryBuilder.mockReturnValueOnce(countQb).mockReturnValueOnce(topQb);

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(42);
      expect(result.top_models).toEqual([
        { model: 'gpt-4o', usage_count: 20 },
        { model: 'claude-opus-4-6', usage_count: 15 },
      ]);
    });

    it('returns zeros when table is empty', async () => {
      const countQb = mockQueryBuilder({ total: '0' });
      const topQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder.mockReturnValueOnce(countQb).mockReturnValueOnce(topQb);

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
    });

    it('handles null count result', async () => {
      const countQb = mockQueryBuilder(null);
      const topQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder.mockReturnValueOnce(countQb).mockReturnValueOnce(topQb);

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(0);
    });

    it('handles count row with undefined total property', async () => {
      const countQb = mockQueryBuilder({});
      const topQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder.mockReturnValueOnce(countQb).mockReturnValueOnce(topQb);

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(0);
    });

    it('applies correct query shape for count', async () => {
      const countQb = mockQueryBuilder({ total: '5' });
      const topQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder.mockReturnValueOnce(countQb).mockReturnValueOnce(topQb);

      await service.getUsageStats();

      expect(countQb.select).toHaveBeenCalledWith('COUNT(*)', 'total');
    });

    it('applies correct query shape for top models', async () => {
      const countQb = mockQueryBuilder({ total: '5' });
      const topQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder.mockReturnValueOnce(countQb).mockReturnValueOnce(topQb);

      await service.getUsageStats();

      expect(topQb.select).toHaveBeenCalledWith('at.model', 'model');
      expect(topQb.addSelect).toHaveBeenCalledWith('COUNT(*)', 'usage_count');
      expect(topQb.where).toHaveBeenCalledWith('at.model IS NOT NULL');
      expect(topQb.groupBy).toHaveBeenCalledWith('at.model');
      expect(topQb.orderBy).toHaveBeenCalledWith('usage_count', 'DESC');
      expect(topQb.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('getModelCatalog', () => {
    it('maps pricing entries to catalog format', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ model_name: 'gpt-4o', provider: 'OpenAI' }),
      ]);
      const rankMap = new Map([['gpt-4o', 1]]);

      const result = service.getModelCatalog(rankMap);

      expect(result).toEqual([
        {
          model_name: 'gpt-4o',
          provider: 'OpenAI',
          display_name: 'Test Model',
          context_window: 128000,
          input_price_per_million: 1,
          output_price_per_million: 2,
          is_free: false,
          usage_rank: 1,
        },
      ]);
    });

    it('sets is_free=true for zero-cost models', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ input_price_per_token: 0, output_price_per_token: 0 }),
      ]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].is_free).toBe(true);
    });

    it('sets is_free=true when prices are null', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ input_price_per_token: null, output_price_per_token: null }),
      ]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].is_free).toBe(true);
      expect(result[0].input_price_per_million).toBeNull();
      expect(result[0].output_price_per_million).toBeNull();
    });

    it('sets is_free=true when input is null and output is zero', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ input_price_per_token: null, output_price_per_token: 0 }),
      ]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].is_free).toBe(true);
      expect(result[0].input_price_per_million).toBeNull();
      expect(result[0].output_price_per_million).toBe(0);
    });

    it('sets is_free=false when input is zero but output is non-zero', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ input_price_per_token: 0, output_price_per_token: 0.000002 }),
      ]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].is_free).toBe(false);
    });

    it('computes input_price_per_million as zero for zero token price', () => {
      mockPricingCache.getAll.mockReturnValue([makePricingEntry({ input_price_per_token: 0 })]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].input_price_per_million).toBe(0);
    });

    it('sets usage_rank=null for unranked models', () => {
      mockPricingCache.getAll.mockReturnValue([makePricingEntry()]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].usage_rank).toBeNull();
    });

    it('sets context_window=null when not available', () => {
      mockPricingCache.getAll.mockReturnValue([makePricingEntry({ context_window: undefined })]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].context_window).toBeNull();
    });

    it('returns empty array when no pricing entries', () => {
      mockPricingCache.getAll.mockReturnValue([]);
      const result = service.getModelCatalog(new Map());
      expect(result).toEqual([]);
    });

    it('uses Unknown as provider fallback for empty string', () => {
      mockPricingCache.getAll.mockReturnValue([makePricingEntry({ provider: '' })]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].provider).toBe('Unknown');
    });

    it('uses Unknown as provider fallback for undefined', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ provider: undefined as unknown as string }),
      ]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].provider).toBe('Unknown');
    });

    it('coerces display_name to null for empty string', () => {
      mockPricingCache.getAll.mockReturnValue([makePricingEntry({ display_name: '' })]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].display_name).toBeNull();
    });

    it('preserves display_name as null when input is null', () => {
      mockPricingCache.getAll.mockReturnValue([makePricingEntry({ display_name: null })]);
      const result = service.getModelCatalog(new Map());
      expect(result[0].display_name).toBeNull();
    });

    it('maps multiple entries preserving order and rank', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({ model_name: 'model-a' }),
        makePricingEntry({ model_name: 'model-b' }),
        makePricingEntry({ model_name: 'model-c' }),
      ]);
      const rankMap = new Map([['model-b', 2]]);
      const result = service.getModelCatalog(rankMap);
      expect(result).toHaveLength(3);
      expect(result[0].model_name).toBe('model-a');
      expect(result[0].usage_rank).toBeNull();
      expect(result[1].model_name).toBe('model-b');
      expect(result[1].usage_rank).toBe(2);
      expect(result[2].usage_rank).toBeNull();
    });
  });

  describe('buildRankMap', () => {
    it('builds 1-indexed rank map from top models', () => {
      const map = service.buildRankMap([
        { model: 'a', usage_count: 100 },
        { model: 'b', usage_count: 50 },
      ]);

      expect(map.get('a')).toBe(1);
      expect(map.get('b')).toBe(2);
    });

    it('returns empty map for no models', () => {
      const map = service.buildRankMap([]);

      expect(map.size).toBe(0);
    });
  });
});
