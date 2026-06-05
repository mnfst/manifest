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

  function setupQueries(
    count: unknown,
    top: unknown,
    tokens7d: unknown,
    tokensPrev7d: unknown = [],
    tokens30d: unknown = [],
  ) {
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(mockQueryBuilder(count))
      .mockReturnValueOnce(mockQueryBuilder(top))
      .mockReturnValueOnce(mockQueryBuilder(tokens7d))
      .mockReturnValueOnce(mockQueryBuilder(tokensPrev7d))
      .mockReturnValueOnce(mockQueryBuilder(tokens30d));
  }

  describe('getUsageStats', () => {
    it('returns enriched top models sorted by tokens_7d', async () => {
      setupQueries(
        { total: '42' },
        [
          { model: 'gpt-4o', usage_count: '20' },
          { model: 'claude-opus', usage_count: '15' },
        ],
        [
          { model: 'gpt-4o', tokens: '1000000' },
          { model: 'claude-opus', tokens: '5000000' },
        ],
        [
          { model: 'gpt-4o', tokens: '900000' },
          { model: 'claude-opus', tokens: '4500000' },
        ],
        [
          { model: 'gpt-4o', tokens: '3500000' },
          { model: 'claude-opus', tokens: '18000000' },
        ],
      );
      mockPricingCache.getByModel.mockImplementation((name: string) => {
        if (name === 'gpt-4o') return makePricingEntry({ provider: 'OpenAI' });
        if (name === 'claude-opus') return makePricingEntry({ provider: 'Anthropic' });
        return null;
      });

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(42);
      expect(result.top_models[0].model).toBe('claude-opus');
      expect(result.top_models[0].tokens_7d).toBe(5000000);
      expect(result.top_models[0].tokens_previous_7d).toBe(4500000);
      expect(result.top_models[0].tokens_30d).toBe(18000000);
      expect(result.top_models[0].usage_rank).toBe(1);
      expect(result.top_models[1].model).toBe('gpt-4o');
      expect(result.top_models[1].tokens_previous_7d).toBe(900000);
      expect(result.top_models[1].tokens_30d).toBe(3500000);
      expect(result.top_models[1].usage_rank).toBe(2);
    });

    it('returns zeros when table is empty', async () => {
      setupQueries({ total: '0' }, [], []);

      const result = await service.getUsageStats();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
    });

    it('handles null count result', async () => {
      setupQueries(null, [], []);
      expect((await service.getUsageStats()).total_messages).toBe(0);
    });

    it('handles undefined total property', async () => {
      setupQueries({}, [], []);
      expect((await service.getUsageStats()).total_messages).toBe(0);
    });

    it('excludes custom models even with known provider', async () => {
      setupQueries({ total: '1' }, [{ model: 'custom:abc/gpt-4o', usage_count: '1' }], []);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(0);
    });

    it('excludes Unknown provider models', async () => {
      setupQueries({ total: '1' }, [{ model: 'unknown-model', usage_count: '1' }], []);

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(0);
    });

    it('includes OpenRouter provider models', async () => {
      setupQueries({ total: '1' }, [{ model: 'openrouter/free', usage_count: '1' }], []);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenRouter' }));

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(1);
      expect(result.top_models[0].provider).toBe('OpenRouter');
    });

    it('limits to 10 results', async () => {
      const rows = Array.from({ length: 15 }, (_, i) => ({
        model: `model-${i}`,
        usage_count: `${15 - i}`,
      }));
      setupQueries({ total: '100' }, rows, []);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'Anthropic' }));

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(10);
    });

    it('handles null tokens in token query', async () => {
      setupQueries(
        { total: '1' },
        [{ model: 'x', usage_count: '1' }],
        [{ model: 'x', tokens: null }],
      );
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getUsageStats();

      expect(result.token_map.get('x')).toBe(0);
    });

    it('applies 7-day cutoff to token query', async () => {
      const tokenQb = mockQueryBuilder([]);
      const prev7dQb = mockQueryBuilder([]);
      const thirtyDayQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder({ total: '0' }))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(tokenQb)
        .mockReturnValueOnce(prev7dQb)
        .mockReturnValueOnce(thirtyDayQb);

      await service.getUsageStats();

      expect(tokenQb.andWhere).toHaveBeenCalledWith(
        'at.timestamp >= :cutoff',
        expect.objectContaining({ cutoff: expect.any(String) }),
      );
    });

    it('applies correct cutoffs to previous-7d query', async () => {
      const prev7dQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder({ total: '0' }))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(prev7dQb)
        .mockReturnValueOnce(mockQueryBuilder([]));

      await service.getUsageStats();

      expect(prev7dQb.andWhere).toHaveBeenCalledWith(
        'at.timestamp >= :cutoff14d',
        expect.objectContaining({ cutoff14d: expect.any(String) }),
      );
      expect(prev7dQb.andWhere).toHaveBeenCalledWith(
        'at.timestamp < :cutoff7d',
        expect.objectContaining({ cutoff7d: expect.any(String) }),
      );
    });

    it('applies correct cutoff to 30d query', async () => {
      const thirtyDayQb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder({ total: '0' }))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(thirtyDayQb);

      await service.getUsageStats();

      expect(thirtyDayQb.andWhere).toHaveBeenCalledWith(
        'at.timestamp >= :cutoff30d',
        expect.objectContaining({ cutoff30d: expect.any(String) }),
      );
    });

    it('defaults tokens_previous_7d and tokens_30d to zero when no data', async () => {
      setupQueries(
        { total: '1' },
        [{ model: 'gpt-4o', usage_count: '1' }],
        [{ model: 'gpt-4o', tokens: '1000' }],
        [],
        [],
      );
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getUsageStats();

      expect(result.top_models[0].tokens_previous_7d).toBe(0);
      expect(result.top_models[0].tokens_30d).toBe(0);
    });
  });

  describe('getFreeModels', () => {
    it('returns free models with tokens_7d > 0, sorted desc', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'a',
          provider: 'Google',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
        makePricingEntry({
          model_name: 'b',
          provider: 'DeepSeek',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      ]);
      const tokenMap = new Map([
        ['a', 1000],
        ['b', 5000],
      ]);

      const result = service.getFreeModels(tokenMap);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ model_name: 'b', provider: 'DeepSeek', tokens_7d: 5000 });
      expect(result[1]).toEqual({ model_name: 'a', provider: 'Google', tokens_7d: 1000 });
    });

    it('excludes models with zero tokens_7d', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'no-usage',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      ]);

      expect(service.getFreeModels(new Map())).toEqual([]);
    });

    it('excludes paid models', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'paid',
          input_price_per_token: 0.001,
          output_price_per_token: 0.002,
        }),
      ]);

      expect(service.getFreeModels(new Map([['paid', 1000]]))).toEqual([]);
    });

    it('excludes Unknown provider', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'a',
          provider: 'Unknown',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      ]);

      expect(service.getFreeModels(new Map([['a', 100]]))).toEqual([]);
    });

    it('includes OpenRouter provider', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'b',
          provider: 'OpenRouter',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      ]);

      const result = service.getFreeModels(new Map([['b', 200]]));
      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('OpenRouter');
    });

    it('excludes custom models', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'custom:abc/model',
          provider: 'OpenAI',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      ]);
      expect(service.getFreeModels(new Map([['custom:abc/model', 500]]))).toEqual([]);
    });

    it('limits to 10 results', () => {
      const entries = Array.from({ length: 15 }, (_, i) =>
        makePricingEntry({
          model_name: `m-${i}`,
          provider: 'Google',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      );
      mockPricingCache.getAll.mockReturnValue(entries);
      const tokenMap = new Map(entries.map((e, i) => [e.model_name, i + 1]));

      expect(service.getFreeModels(tokenMap)).toHaveLength(10);
    });

    it('treats null prices as free', () => {
      mockPricingCache.getAll.mockReturnValue([
        makePricingEntry({
          model_name: 'n',
          provider: 'Google',
          input_price_per_token: null,
          output_price_per_token: null,
        }),
      ]);

      const result = service.getFreeModels(new Map([['n', 500]]));

      expect(result).toHaveLength(1);
    });
  });

  describe('getProviderDailyTokens', () => {
    function setupProviderQuery(rows: unknown) {
      const qb = mockQueryBuilder(rows);
      qb.addGroupBy = jest.fn().mockReturnValue(qb);
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);
      return qb;
    }

    it('groups tokens by provider and model with daily breakdown', async () => {
      setupProviderQuery([
        {
          model: 'gpt-4o',
          date: '2026-04-06',
          tokens: '500000',
          auth_type: 'api_key',
          cost: '0.50',
        },
        {
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '600000',
          auth_type: 'api_key',
          cost: '0.60',
        },
        {
          model: 'claude-opus',
          date: '2026-04-07',
          tokens: '1000000',
          auth_type: 'api_key',
          cost: '1.00',
        },
      ]);
      mockPricingCache.getByModel.mockImplementation((name: string) => {
        if (name === 'gpt-4o') return makePricingEntry({ provider: 'OpenAI' });
        if (name === 'claude-opus') return makePricingEntry({ provider: 'Anthropic' });
        return null;
      });

      const result = await service.getProviderDailyTokens();

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('OpenAI');
      expect(result[0].total_tokens).toBe(1100000);
      expect(result[0].models).toHaveLength(1);
      expect(result[0].models[0].model).toBe('gpt-4o');
      expect(result[0].models[0].auth_type).toBe('api_key');
      expect(result[0].models[0].total_cost).toBeCloseTo(1.1);
      expect(result[0].models[0].daily).toEqual([
        { date: '2026-04-06', tokens: 500000 },
        { date: '2026-04-07', tokens: 600000 },
      ]);
      expect(result[1].provider).toBe('Anthropic');
      expect(result[1].total_tokens).toBe(1000000);
    });

    it('sorts providers by total tokens descending', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '100', auth_type: null, cost: null },
        { model: 'claude-opus', date: '2026-04-07', tokens: '9999', auth_type: null, cost: null },
      ]);
      mockPricingCache.getByModel.mockImplementation((name: string) => {
        if (name === 'gpt-4o') return makePricingEntry({ provider: 'OpenAI' });
        if (name === 'claude-opus') return makePricingEntry({ provider: 'Anthropic' });
        return null;
      });

      const result = await service.getProviderDailyTokens();

      expect(result[0].provider).toBe('Anthropic');
      expect(result[1].provider).toBe('OpenAI');
    });

    it('sorts models within a provider by total tokens descending', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '100', auth_type: null, cost: null },
        { model: 'gpt-4o-mini', date: '2026-04-07', tokens: '9000', auth_type: null, cost: null },
      ]);
      mockPricingCache.getByModel.mockImplementation(() =>
        makePricingEntry({ provider: 'OpenAI' }),
      );

      const result = await service.getProviderDailyTokens();

      expect(result[0].models[0].model).toBe('gpt-4o-mini');
      expect(result[0].models[1].model).toBe('gpt-4o');
    });

    it('returns empty array when no data', async () => {
      setupProviderQuery([]);

      const result = await service.getProviderDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes custom models', async () => {
      setupProviderQuery([
        {
          model: 'custom:abc/gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes Unknown provider models', async () => {
      setupProviderQuery([
        { model: 'mystery-model', date: '2026-04-07', tokens: '1000', auth_type: null, cost: null },
      ]);

      const result = await service.getProviderDailyTokens();

      expect(result).toEqual([]);
    });

    it('handles null tokens', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: null, auth_type: null, cost: null },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result[0].total_tokens).toBe(0);
      expect(result[0].models[0].daily[0].tokens).toBe(0);
    });

    it('sorts daily entries chronologically', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '200', auth_type: null, cost: null },
        { model: 'gpt-4o', date: '2026-04-05', tokens: '100', auth_type: null, cost: null },
        { model: 'gpt-4o', date: '2026-04-06', tokens: '150', auth_type: null, cost: null },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      const dates = result[0].models[0].daily.map((d) => d.date);
      expect(dates).toEqual(['2026-04-05', '2026-04-06', '2026-04-07']);
    });

    it('applies 30-day cutoff', async () => {
      const qb = mockQueryBuilder([]);
      qb.addGroupBy = jest.fn().mockReturnValue(qb);
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.getProviderDailyTokens();

      expect(qb.andWhere).toHaveBeenCalledWith(
        'at.timestamp >= :cutoff30d',
        expect.objectContaining({ cutoff30d: expect.any(String) }),
      );
    });

    it('aggregates multiple models under the same provider', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '500', auth_type: null, cost: null },
        { model: 'gpt-4o-mini', date: '2026-04-07', tokens: '300', auth_type: null, cost: null },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('OpenAI');
      expect(result[0].total_tokens).toBe(800);
      expect(result[0].models).toHaveLength(2);
    });

    it('separates same model with different auth_types', async () => {
      setupProviderQuery([
        {
          model: 'claude-sonnet',
          date: '2026-04-07',
          tokens: '3000',
          auth_type: 'api_key',
          cost: '0.45',
        },
        {
          model: 'claude-sonnet',
          date: '2026-04-07',
          tokens: '2000',
          auth_type: 'subscription',
          cost: '0',
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'Anthropic' }));

      const result = await service.getProviderDailyTokens();

      expect(result).toHaveLength(1);
      expect(result[0].models).toHaveLength(2);
      const apiKeyModel = result[0].models.find((m) => m.auth_type === 'api_key');
      const subModel = result[0].models.find((m) => m.auth_type === 'subscription');
      expect(apiKeyModel).toBeDefined();
      expect(apiKeyModel!.total_tokens).toBe(3000);
      expect(apiKeyModel!.total_cost).toBeCloseTo(0.45);
      expect(subModel).toBeDefined();
      expect(subModel!.total_tokens).toBe(2000);
      expect(subModel!.total_cost).toBe(0);

      // The provider is also broken down by auth type so the public site can
      // list it once per auth method.
      expect(result[0].auth_types).toContainEqual({
        auth_type: 'api_key',
        total_tokens: 3000,
        model_count: 1,
      });
      expect(result[0].auth_types).toContainEqual({
        auth_type: 'subscription',
        total_tokens: 2000,
        model_count: 1,
      });
    });

    it('breaks a provider down by auth type, counting null usage as api_key', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '500', auth_type: null, cost: null },
        {
          model: 'gpt-4o-mini',
          date: '2026-04-07',
          tokens: '300',
          auth_type: 'api_key',
          cost: null,
        },
        {
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '2000',
          auth_type: 'subscription',
          cost: null,
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      const apiKey = result[0].auth_types.find((a) => a.auth_type === 'api_key');
      const sub = result[0].auth_types.find((a) => a.auth_type === 'subscription');
      // gpt-4o (null → api_key) + gpt-4o-mini (api_key) collapse into one bucket.
      expect(apiKey).toEqual({ auth_type: 'api_key', total_tokens: 800, model_count: 2 });
      expect(sub).toEqual({ auth_type: 'subscription', total_tokens: 2000, model_count: 1 });
      // Breakdown is sorted by token usage descending.
      expect(result[0].auth_types[0].auth_type).toBe('subscription');
    });

    it('excludes zero-token models from auth_types model_count', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: null, auth_type: 'api_key', cost: null },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result[0].auth_types).toEqual([
        { auth_type: 'api_key', total_tokens: 0, model_count: 0 },
      ]);
    });

    it('returns null total_cost when all costs are null', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '1000', auth_type: 'api_key', cost: null },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result[0].models[0].total_cost).toBeNull();
    });

    it('sums cost correctly across multiple days', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-06', tokens: '500', auth_type: 'api_key', cost: '0.10' },
        { model: 'gpt-4o', date: '2026-04-07', tokens: '500', auth_type: 'api_key', cost: '0.20' },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result[0].models[0].total_cost).toBeCloseTo(0.3);
    });

    it('includes auth_type as null when not set', async () => {
      setupProviderQuery([
        { model: 'gpt-4o', date: '2026-04-07', tokens: '1000', auth_type: null, cost: null },
      ]);
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: 'OpenAI' }));

      const result = await service.getProviderDailyTokens();

      expect(result[0].models[0].auth_type).toBeNull();
    });
  });

  describe('getAgentDailyTokens', () => {
    function setupAgentQuery(rows: unknown) {
      const qb = mockQueryBuilder(rows);
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.addGroupBy = jest.fn().mockReturnValue(qb);
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);
      return qb;
    }

    it('groups tokens by (category, platform) and model with daily breakdown', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-06',
          tokens: '500000',
          auth_type: 'api_key',
          cost: '0.50',
        },
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '600000',
          auth_type: 'api_key',
          cost: '0.60',
        },
        {
          agent_category: 'coding',
          agent_platform: 'claude-code',
          model: 'claude-opus',
          date: '2026-04-07',
          tokens: '1000000',
          auth_type: 'api_key',
          cost: '1.00',
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toHaveLength(2);
      expect(result[0].agent_category).toBe('personal');
      expect(result[0].agent_platform).toBe('openclaw');
      expect(result[0].category_label).toBe('AI agents');
      expect(result[0].platform_label).toBe('OpenClaw');
      expect(result[0].total_tokens).toBe(1100000);
      expect(result[0].models).toHaveLength(1);
      expect(result[0].models[0].model).toBe('gpt-4o');
      expect(result[0].models[0].auth_type).toBe('api_key');
      expect(result[0].models[0].total_cost).toBeCloseTo(1.1);
      expect(result[0].models[0].daily).toEqual([
        { date: '2026-04-06', tokens: 500000 },
        { date: '2026-04-07', tokens: 600000 },
      ]);
      expect(result[1].agent_category).toBe('coding');
      expect(result[1].agent_platform).toBe('claude-code');
      expect(result[1].category_label).toBe('Coding Assistant');
      expect(result[1].platform_label).toBe('Claude Code');
      expect(result[1].total_tokens).toBe(1000000);
    });

    it('sorts agent groups by total tokens descending', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '100',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'coding',
          agent_platform: 'claude-code',
          model: 'claude-opus',
          date: '2026-04-07',
          tokens: '9999',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result[0].agent_platform).toBe('claude-code');
      expect(result[1].agent_platform).toBe('openclaw');
    });

    it('sorts models within an agent group by total tokens descending', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '100',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o-mini',
          date: '2026-04-07',
          tokens: '9000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result[0].models[0].model).toBe('gpt-4o-mini');
      expect(result[0].models[1].model).toBe('gpt-4o');
    });

    it('returns empty array when no data', async () => {
      setupAgentQuery([]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes custom models', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'custom:abc/gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it("excludes 'other' platform", async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'other',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes rows with NULL category', async () => {
      setupAgentQuery([
        {
          agent_category: null,
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes rows with NULL platform', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: null,
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes unknown category values', async () => {
      setupAgentQuery([
        {
          agent_category: 'mystery',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it('excludes unknown platform values', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'mystery-platform',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toEqual([]);
    });

    it('handles null tokens', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: null,
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result[0].total_tokens).toBe(0);
      expect(result[0].models[0].daily[0].tokens).toBe(0);
    });

    it('sorts daily entries chronologically', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '200',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-05',
          tokens: '100',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-06',
          tokens: '150',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      const dates = result[0].models[0].daily.map((d) => d.date);
      expect(dates).toEqual(['2026-04-05', '2026-04-06', '2026-04-07']);
    });

    it('applies 30-day cutoff', async () => {
      const qb = setupAgentQuery([]);

      await service.getAgentDailyTokens();

      expect(qb.andWhere).toHaveBeenCalledWith(
        'at.timestamp >= :cutoff30d',
        expect.objectContaining({ cutoff30d: expect.any(String) }),
      );
    });

    it('aggregates multiple models under the same agent group', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '500',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o-mini',
          date: '2026-04-07',
          tokens: '300',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toHaveLength(1);
      expect(result[0].agent_platform).toBe('openclaw');
      expect(result[0].total_tokens).toBe(800);
      expect(result[0].models).toHaveLength(2);
    });

    it('separates same model with different auth_types', async () => {
      setupAgentQuery([
        {
          agent_category: 'coding',
          agent_platform: 'claude-code',
          model: 'claude-sonnet',
          date: '2026-04-07',
          tokens: '3000',
          auth_type: 'api_key',
          cost: '0.45',
        },
        {
          agent_category: 'coding',
          agent_platform: 'claude-code',
          model: 'claude-sonnet',
          date: '2026-04-07',
          tokens: '2000',
          auth_type: 'subscription',
          cost: '0',
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result).toHaveLength(1);
      expect(result[0].models).toHaveLength(2);
      const apiKeyModel = result[0].models.find((m) => m.auth_type === 'api_key');
      const subModel = result[0].models.find((m) => m.auth_type === 'subscription');
      expect(apiKeyModel).toBeDefined();
      expect(apiKeyModel!.total_tokens).toBe(3000);
      expect(apiKeyModel!.total_cost).toBeCloseTo(0.45);
      expect(subModel).toBeDefined();
      expect(subModel!.total_tokens).toBe(2000);
      expect(subModel!.total_cost).toBe(0);
    });

    it('returns null total_cost when all costs are null', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: 'api_key',
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result[0].models[0].total_cost).toBeNull();
    });

    it('sums cost correctly across multiple days', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-06',
          tokens: '500',
          auth_type: 'api_key',
          cost: '0.10',
        },
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '500',
          auth_type: 'api_key',
          cost: '0.20',
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result[0].models[0].total_cost).toBeCloseTo(0.3);
    });

    it('includes auth_type as null when not set', async () => {
      setupAgentQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      expect(result[0].models[0].auth_type).toBeNull();
    });

    it('attaches human-readable labels for every supported platform', async () => {
      setupAgentQuery([
        {
          agent_category: 'app',
          agent_platform: 'openai-sdk',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '100',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'app',
          agent_platform: 'anthropic-sdk',
          model: 'claude-opus',
          date: '2026-04-07',
          tokens: '50',
          auth_type: null,
          cost: null,
        },
        {
          agent_category: 'app',
          agent_platform: 'vercel-ai-sdk',
          model: 'gpt-4o-mini',
          date: '2026-04-07',
          tokens: '25',
          auth_type: null,
          cost: null,
        },
      ]);

      const result = await service.getAgentDailyTokens();

      const byPlatform = Object.fromEntries(
        result.map((g) => [g.agent_platform, g.platform_label]),
      );
      expect(byPlatform['openai-sdk']).toBe('OpenAI SDK');
      expect(byPlatform['anthropic-sdk']).toBe('Anthropic SDK');
      expect(byPlatform['vercel-ai-sdk']).toBe('Vercel AI SDK');
      result.forEach((g) => expect(g.category_label).toBe('App AI SDK'));
    });
  });
});
