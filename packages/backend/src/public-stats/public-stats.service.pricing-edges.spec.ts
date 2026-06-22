import { PublicStatsService } from './public-stats.service';
import {
  ModelPricingCacheService,
  PricingEntry,
} from '../model-prices/model-pricing-cache.service';

/**
 * Pricing-edge regression tests for PublicStatsService.
 *
 * The main spec covers the happy paths and the `getByModel() === null` branch.
 * This file pins behavior for the "object returned but key fields missing" cases:
 * a stale cache row, a partial models.dev response, or a custom provider entry
 * that never resolved its pricing/provider columns. Without these tests the
 * pricing-derivation branches (lines 154-173, 228-230 of the source) silently
 * change shape.
 */

function mockQueryBuilder(result: unknown) {
  const qb: Record<string, jest.Mock> = {};
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.limit = jest.fn().mockReturnValue(qb);
  qb.innerJoin = jest.fn().mockReturnValue(qb);
  qb.addGroupBy = jest.fn().mockReturnValue(qb);
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

describe('PublicStatsService — pricing edge cases', () => {
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

  function setupUsageQueries(
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

  function setupProviderDailyQuery(rows: unknown) {
    mockRepo.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder(rows));
  }

  function setupAgentDailyQuery(rows: unknown) {
    mockRepo.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder(rows));
  }

  describe('getUsageStats — partial pricing entries', () => {
    it('excludes models when getByModel returns provider=null + undefined/null prices', async () => {
      // Simulates a stale or partial cache row: object exists but provider is
      // falsy. `pricing?.provider || 'Unknown'` then collapses to 'Unknown',
      // which is in EXCLUDED_PROVIDERS, so the model must be skipped entirely.
      setupUsageQueries(
        { total: '1' },
        [{ model: 'stale-model', usage_count: '1' }],
        [{ model: 'stale-model', tokens: '5000' }],
      );
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'stale-model',
        provider: null,
        input_price_per_token: undefined,
        output_price_per_token: null,
        display_name: null,
      } as unknown as PricingEntry);

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(0);
      // Token map still reflects the row — only the top-models projection
      // filters by provider, the raw 7d token map is unfiltered.
      expect(result.token_map.get('stale-model')).toBe(5000);
    });

    it('excludes models when provider is the empty string', async () => {
      setupUsageQueries(
        { total: '1' },
        [{ model: 'empty-provider', usage_count: '1' }],
        [{ model: 'empty-provider', tokens: '1' }],
      );
      mockPricingCache.getByModel.mockReturnValue(makePricingEntry({ provider: '' }));

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(0);
    });

    it('returns null price_per_million when prices are missing but provider is known', async () => {
      // Provider is OK, so the row survives the EXCLUDED_PROVIDERS gate.
      // The price fields must coerce undefined and null into null (not NaN,
      // not 0). The source uses `!= null` which catches both undefined and
      // null — this test pins that contract.
      setupUsageQueries(
        { total: '1' },
        [{ model: 'priceless-model', usage_count: '1' }],
        [{ model: 'priceless-model', tokens: '2000' }],
      );
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'priceless-model',
        provider: 'OpenAI',
        input_price_per_token: undefined,
        output_price_per_token: null,
        display_name: null,
      } as unknown as PricingEntry);

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(1);
      expect(result.top_models[0].provider).toBe('OpenAI');
      expect(result.top_models[0].input_price_per_million).toBeNull();
      expect(result.top_models[0].output_price_per_million).toBeNull();
      expect(result.top_models[0].tokens_7d).toBe(2000);
    });

    it('keeps explicit zero prices as 0, not null', async () => {
      // Free-tier models legitimately price at 0. The `!= null` check must
      // let zero through so the UI can distinguish "free" from "unknown".
      setupUsageQueries(
        { total: '1' },
        [{ model: 'free-model', usage_count: '1' }],
        [{ model: 'free-model', tokens: '100' }],
      );
      mockPricingCache.getByModel.mockReturnValue(
        makePricingEntry({
          provider: 'Google',
          input_price_per_token: 0,
          output_price_per_token: 0,
        }),
      );

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(1);
      expect(result.top_models[0].input_price_per_million).toBe(0);
      expect(result.top_models[0].output_price_per_million).toBe(0);
    });

    it('handles mixed-presence price fields (input set, output missing)', async () => {
      setupUsageQueries(
        { total: '1' },
        [{ model: 'half-priced', usage_count: '1' }],
        [{ model: 'half-priced', tokens: '50' }],
      );
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'half-priced',
        provider: 'Anthropic',
        input_price_per_token: 0.000003,
        output_price_per_token: undefined,
        display_name: null,
      } as unknown as PricingEntry);

      const result = await service.getUsageStats();

      expect(result.top_models).toHaveLength(1);
      expect(result.top_models[0].input_price_per_million).toBeCloseTo(3);
      expect(result.top_models[0].output_price_per_million).toBeNull();
    });
  });

  describe('getProviderDailyTokens — partial pricing entries', () => {
    it('excludes rows when getByModel returns provider=null', async () => {
      setupProviderDailyQuery([
        {
          model: 'stale-model',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: 'api_key',
          cost: '0.10',
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'stale-model',
        provider: null,
        input_price_per_token: undefined,
        output_price_per_token: null,
        display_name: null,
      } as unknown as PricingEntry);

      const result = await service.getProviderDailyTokens();

      expect(result).toEqual([]);
    });

    it('includes rows when provider is set even if price fields are missing', async () => {
      // The provider-daily endpoint does not project prices, so missing
      // price fields should not affect grouping at all.
      setupProviderDailyQuery([
        {
          model: 'priceless-model',
          date: '2026-04-07',
          tokens: '2000',
          auth_type: 'api_key',
          cost: '0.25',
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'priceless-model',
        provider: 'OpenAI',
        input_price_per_token: undefined,
        output_price_per_token: null,
        display_name: null,
      } as unknown as PricingEntry);

      const result = await service.getProviderDailyTokens();

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('OpenAI');
      expect(result[0].total_tokens).toBe(2000);
      expect(result[0].models[0].total_cost).toBeCloseTo(0.25);
    });
  });

  describe('getAgentDailyTokens — partial pricing entries', () => {
    // getAgentDailyTokens does not consult pricingCache at all (its provider
    // axis is the agent, not the LLM provider), but we pin that here so a
    // future refactor that adds pricing-cache lookups is forced to revisit
    // these edge cases.
    it('ignores pricing cache state entirely (does not call getByModel)', async () => {
      setupAgentDailyQuery([
        {
          agent_category: 'personal',
          agent_platform: 'openclaw',
          model: 'gpt-4o',
          date: '2026-04-07',
          tokens: '1000',
          auth_type: 'api_key',
          cost: '0.10',
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'gpt-4o',
        provider: null,
        input_price_per_token: undefined,
        output_price_per_token: null,
        display_name: null,
      } as unknown as PricingEntry);

      const result = await service.getAgentDailyTokens();

      expect(result).toHaveLength(1);
      expect(result[0].agent_platform).toBe('openclaw');
      expect(result[0].total_tokens).toBe(1000);
      expect(mockPricingCache.getByModel).not.toHaveBeenCalled();
    });
  });
});
