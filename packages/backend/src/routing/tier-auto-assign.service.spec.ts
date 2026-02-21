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

    it('should prefer cheapest for standard, with code bonus', () => {
      const cheapNoCode = makeModel({
        model_name: 'cheap-no-code',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        capability_code: false,
      });
      const cheapWithCode = makeModel({
        model_name: 'cheap-with-code',
        input_price_per_token: 0.0000012,
        output_price_per_token: 0.0000024,
        capability_code: true,
      });

      // Code model is slightly more expensive but gets 1.2x bonus
      // cheap-no-code: 1/0.000003 = 333333
      // cheap-with-code: 1/0.0000036 * 1.2 = 333333 → roughly equal, code wins
      const result = service.pickBest([cheapNoCode, cheapWithCode], 'standard');
      expect(result!.model_name).toBe('cheap-with-code');
    });

    it('should prefer capable models for complex tier over cheap ones', () => {
      const cheapDumb = makeModel({
        model_name: 'cheap-dumb',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        context_window: 32000,
        capability_code: false,
        capability_reasoning: false,
      });
      const expensiveSmart = makeModel({
        model_name: 'expensive-smart',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        context_window: 200000,
        capability_code: true,
        capability_reasoning: true,
      });

      // cheap-dumb: quality=0, score = 0*1000 + costScore
      // expensive-smart: quality=3 (code+reasoning+context), score = 3*1000 + costScore
      const result = service.pickBest([cheapDumb, expensiveSmart], 'complex');
      expect(result!.model_name).toBe('expensive-smart');
    });

    it('should prefer reasoning models for reasoning tier over cheap ones', () => {
      const cheapNoReasoning = makeModel({
        model_name: 'cheap',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        capability_reasoning: false,
      });
      const expensiveReasoning = makeModel({
        model_name: 'reasoning',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        capability_reasoning: true,
        context_window: 200000,
      });

      const result = service.pickBest([cheapNoReasoning, expensiveReasoning], 'reasoning');
      expect(result!.model_name).toBe('reasoning');
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

    it('should differentiate tiers with a single provider (Gemini-like)', () => {
      const flashLite = makeModel({
        model_name: 'gemini-2.5-flash-lite',
        provider: 'Google',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        context_window: 1048576,
        capability_reasoning: false,
        capability_code: false,
      });
      const flash = makeModel({
        model_name: 'gemini-2.5-flash',
        provider: 'Google',
        input_price_per_token: 0.00000015,
        output_price_per_token: 0.0000006,
        context_window: 1048576,
        capability_reasoning: false,
        capability_code: true,
      });
      const pro = makeModel({
        model_name: 'gemini-2.5-pro',
        provider: 'Google',
        input_price_per_token: 0.00000125,
        output_price_per_token: 0.00001,
        context_window: 1048576,
        capability_reasoning: true,
        capability_code: true,
      });

      const models = [flashLite, flash, pro];

      // Simple: cheapest → flash-lite
      expect(service.pickBest(models, 'simple')!.model_name).toBe('gemini-2.5-flash-lite');
      // Standard: cheapest with code bonus, but flash-lite is so much cheaper it still wins
      expect(service.pickBest(models, 'standard')!.model_name).toBe('gemini-2.5-flash-lite');
      // Complex: quality-first → pro (reasoning+code+context = 3)
      expect(service.pickBest(models, 'complex')!.model_name).toBe('gemini-2.5-pro');
      // Reasoning: reasoning required → pro (reasoning=3 + code + context)
      expect(service.pickBest(models, 'reasoning')!.model_name).toBe('gemini-2.5-pro');
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

    it('should pick different models per tier with two providers', async () => {
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
        capability_code: true,
      });
      const reasoning = makeModel({
        model_name: 'claude-opus-4',
        provider: 'Anthropic',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        context_window: 200000,
        capability_reasoning: true,
        capability_code: true,
      });
      mockPricingCache.getAll.mockReturnValue([cheap, reasoning]);

      await service.recalculate('user-1');

      const assignments = mockTierRepo.insert.mock.calls.map(
        (c: unknown[]) => c[0] as { tier: string; auto_assigned_model: string },
      );

      // Simple/standard: cheapest wins
      expect(assignments.find((a) => a.tier === 'simple')!.auto_assigned_model).toBe('gpt-4o-mini');
      expect(assignments.find((a) => a.tier === 'standard')!.auto_assigned_model).toBe('gpt-4o-mini');
      // Complex: opus has quality 3 (reasoning+code+context), mini has quality 2 (code+context)
      expect(assignments.find((a) => a.tier === 'complex')!.auto_assigned_model).toBe('claude-opus-4');
      // Reasoning: opus has reasoning capability
      expect(assignments.find((a) => a.tier === 'reasoning')!.auto_assigned_model).toBe('claude-opus-4');
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

      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          override_model: 'claude-opus-4-6',
          auto_assigned_model: 'gpt-4o',
        }),
      );
    });
  });
});
