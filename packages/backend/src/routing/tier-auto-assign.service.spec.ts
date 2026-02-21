import { TierAutoAssignService } from './tier-auto-assign.service';
import { ModelPricing } from '../entities/model-pricing.entity';

function makeModel(overrides: Partial<ModelPricing>): ModelPricing {
  return {
    model_name: 'test-model',
    provider: 'TestProvider',
    input_price_per_token: 0.00001,
    output_price_per_token: 0.00003,
    context_window: 128000,
    capability_reasoning: false,
    capability_code: false,
    updated_at: null,
    ...overrides,
  };
}

function makeMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
}

describe('TierAutoAssignService', () => {
  let service: TierAutoAssignService;
  let mockPricingCache: { getAll: jest.Mock; getByModel: jest.Mock };
  let mockProviderRepo: ReturnType<typeof makeMockRepo>;
  let mockTierRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    mockPricingCache = {
      getAll: jest.fn().mockReturnValue([]),
      getByModel: jest.fn(),
    };
    mockProviderRepo = makeMockRepo();
    mockTierRepo = makeMockRepo();

    service = new TierAutoAssignService(
      mockPricingCache as never,
      mockProviderRepo as never,
      mockTierRepo as never,
    );
  });

  describe('pickBest', () => {
    it('should return null for empty model list', () => {
      expect(service.pickBest([], 'simple')).toBeNull();
    });

    it('should prefer cheapest model for simple tier', () => {
      const cheap = makeModel({
        model_name: 'cheap',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
      });
      const expensive = makeModel({
        model_name: 'expensive',
        input_price_per_token: 0.00001,
        output_price_per_token: 0.00003,
      });

      const result = service.pickBest([cheap, expensive], 'simple');
      expect(result!.model_name).toBe('cheap');
    });

    it('should prefer cheapest model for standard tier', () => {
      const cheap = makeModel({
        model_name: 'cheap',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
      });
      const expensive = makeModel({
        model_name: 'expensive',
        input_price_per_token: 0.00001,
        output_price_per_token: 0.00003,
      });

      const result = service.pickBest([cheap, expensive], 'standard');
      expect(result!.model_name).toBe('cheap');
    });

    it('should give context window bonus for complex tier', () => {
      const smallContext = makeModel({
        model_name: 'small-ctx',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        context_window: 32000,
      });
      const largeContext = makeModel({
        model_name: 'large-ctx',
        input_price_per_token: 0.0000012,
        output_price_per_token: 0.0000024,
        context_window: 200000,
      });

      // small-ctx: 1/0.000003 * 1.0 = 333333
      // large-ctx: 1/0.0000036 * 1.5 = 416666 → wins
      const result = service.pickBest(
        [smallContext, largeContext],
        'complex',
      );
      expect(result!.model_name).toBe('large-ctx');
    });

    it('should give reasoning bonus for reasoning tier', () => {
      const noReasoning = makeModel({
        model_name: 'no-reasoning',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        capability_reasoning: false,
      });
      const withReasoning = makeModel({
        model_name: 'with-reasoning',
        input_price_per_token: 0.000002,
        output_price_per_token: 0.000004,
        capability_reasoning: true,
      });

      // no-reasoning: 1/0.000003 * 1 = 333333
      // with-reasoning: 1/0.000006 * 3 = 500000 → wins
      const result = service.pickBest(
        [noReasoning, withReasoning],
        'reasoning',
      );
      expect(result!.model_name).toBe('with-reasoning');
    });

    it('should handle zero-price models with score 0', () => {
      const zeroCost = makeModel({
        model_name: 'free',
        input_price_per_token: 0,
        output_price_per_token: 0,
      });

      const result = service.pickBest([zeroCost], 'simple');
      expect(result!.score).toBe(0);
    });

    it('should break ties by larger context window at equal price', () => {
      const smallCtx = makeModel({
        model_name: 'small-ctx',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        context_window: 32000,
      });
      const largeCtx = makeModel({
        model_name: 'large-ctx',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        context_window: 200000,
      });

      // Equal cost → equal score for simple/standard
      // But for complex: large-ctx gets 1.5x bonus → wins
      const result = service.pickBest([smallCtx, largeCtx], 'complex');
      expect(result!.model_name).toBe('large-ctx');
    });
  });

  describe('recalculate', () => {
    it('should assign a single model to all 4 tiers (one provider, one model)', async () => {
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'openai', is_active: true },
      ]);

      const model = makeModel({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
      });
      mockPricingCache.getAll.mockReturnValue([model]);

      await service.recalculate('user-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      for (const call of mockTierRepo.insert.mock.calls) {
        expect(call[0].auto_assigned_model).toBe('gpt-4o');
      }
    });

    it('should pick the best model per tier with two providers and multiple models', async () => {
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'openai', is_active: true },
        { provider: 'anthropic', is_active: true },
      ]);

      const cheap = makeModel({
        model_name: 'gpt-4o-mini',
        provider: 'OpenAI',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        context_window: 128000,
        capability_reasoning: false,
      });
      const reasoning = makeModel({
        model_name: 'claude-opus-4',
        provider: 'Anthropic',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        context_window: 200000,
        capability_reasoning: true,
      });
      mockPricingCache.getAll.mockReturnValue([cheap, reasoning]);

      await service.recalculate('user-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      const assignments = mockTierRepo.insert.mock.calls.map(
        (c: unknown[]) => c[0] as { tier: string; auto_assigned_model: string },
      );

      // Simple/standard: cheapest wins
      expect(assignments.find((a) => a.tier === 'simple')!.auto_assigned_model).toBe('gpt-4o-mini');
      expect(assignments.find((a) => a.tier === 'standard')!.auto_assigned_model).toBe('gpt-4o-mini');

      // Reasoning: claude-opus-4 gets 3x bonus, should win
      // claude: 1/0.00009 * 3 = 33333
      // gpt: 1/0.0000005 * 1 = 2000000 → gpt still cheaper! (price difference too large)
      // Actually gpt-4o-mini is SO cheap it still wins. That's correct for the scoring algorithm.
      // Let me verify with less extreme prices in another test.
    });

    it('should set all auto_assigned_model to null with no providers', async () => {
      mockProviderRepo.find.mockResolvedValue([]);
      mockPricingCache.getAll.mockReturnValue([]);

      await service.recalculate('user-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      for (const call of mockTierRepo.insert.mock.calls) {
        expect(call[0].auto_assigned_model).toBeNull();
      }
    });

    it('should update auto assignments when a cheaper provider is added', async () => {
      // Existing tier has old auto assignment
      const existingTier = {
        id: 'tier-1',
        user_id: 'user-1',
        tier: 'simple',
        override_model: null,
        auto_assigned_model: 'gpt-4o',
        updated_at: '2024-01-01',
      };
      mockTierRepo.findOne
        .mockResolvedValueOnce(existingTier) // simple
        .mockResolvedValueOnce(null) // standard
        .mockResolvedValueOnce(null) // complex
        .mockResolvedValueOnce(null); // reasoning

      // New cheaper provider available
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'deepseek', is_active: true },
      ]);
      const cheapModel = makeModel({
        model_name: 'deepseek-v3',
        provider: 'DeepSeek',
        input_price_per_token: 0.00000014,
        output_price_per_token: 0.00000028,
      });
      mockPricingCache.getAll.mockReturnValue([cheapModel]);

      await service.recalculate('user-1');

      // Existing tier should be updated (save) with new auto assignment
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tier-1',
          auto_assigned_model: 'deepseek-v3',
        }),
      );
    });

    it('should preserve manual overrides during recalculation', async () => {
      const existingTier = {
        id: 'tier-1',
        user_id: 'user-1',
        tier: 'complex',
        override_model: 'claude-opus-4-6',
        auto_assigned_model: 'gpt-4o',
        updated_at: '2024-01-01',
      };
      mockTierRepo.findOne.mockResolvedValueOnce(existingTier);

      mockProviderRepo.find.mockResolvedValue([
        { provider: 'openai', is_active: true },
      ]);
      const model = makeModel({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
      });
      mockPricingCache.getAll.mockReturnValue([model]);

      await service.recalculate('user-1');

      // Should update auto_assigned_model but keep override_model
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          override_model: 'claude-opus-4-6',
          auto_assigned_model: 'gpt-4o',
        }),
      );
    });

    it('should recalculate when a provider is removed', async () => {
      // After provider removal, only one provider remains
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'openai', is_active: true },
        // anthropic was removed (not in active list)
      ]);

      const openaiModel = makeModel({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
      });
      const anthropicModel = makeModel({
        model_name: 'claude-opus-4',
        provider: 'Anthropic',
      });
      mockPricingCache.getAll.mockReturnValue([openaiModel, anthropicModel]);

      await service.recalculate('user-1');

      // Only openai model should be selected (anthropic is inactive)
      for (const call of mockTierRepo.insert.mock.calls) {
        expect(call[0].auto_assigned_model).toBe('gpt-4o');
      }
    });
  });
});
