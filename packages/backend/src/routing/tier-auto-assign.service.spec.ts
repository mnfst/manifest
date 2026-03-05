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
    quality_score: 3,
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

    it('should pick free models (e.g. local Ollama)', () => {
      const free = makeModel({
        model_name: 'free',
        input_price_per_token: 0,
        output_price_per_token: 0,
      });
      expect(service.pickBest([free], 'simple')!.model_name).toBe('free');
    });

    // ── SIMPLE: cheapest wins ──

    it('simple: should pick cheapest model', () => {
      const cheap = makeModel({
        model_name: 'cheap',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        quality_score: 1,
      });
      const expensive = makeModel({
        model_name: 'expensive',
        input_price_per_token: 0.00001,
        output_price_per_token: 0.00003,
        quality_score: 5,
      });

      expect(service.pickBest([cheap, expensive], 'simple')!.model_name).toBe('cheap');
    });

    it('simple: quality does not matter', () => {
      const lowQ = makeModel({
        model_name: 'low-q',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 1,
      });
      const highQ = makeModel({
        model_name: 'high-q',
        input_price_per_token: 0.0000002,
        output_price_per_token: 0.0000008,
        quality_score: 5,
      });

      expect(service.pickBest([lowQ, highQ], 'simple')!.model_name).toBe('low-q');
    });

    // ── STANDARD: cheapest among quality >= 2 ──

    it('standard: should exclude quality 1 models', () => {
      const ultraCheap = makeModel({
        model_name: 'ultra-cheap',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 1,
      });
      const decent = makeModel({
        model_name: 'decent',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        quality_score: 2,
      });

      expect(service.pickBest([ultraCheap, decent], 'standard')!.model_name).toBe('decent');
    });

    it('standard: should fallback to cheapest if all are quality 1', () => {
      const a = makeModel({
        model_name: 'a',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 1,
      });
      const b = makeModel({
        model_name: 'b',
        input_price_per_token: 0.0000002,
        output_price_per_token: 0.0000008,
        quality_score: 1,
      });

      expect(service.pickBest([a, b], 'standard')!.model_name).toBe('a');
    });

    // ── COMPLEX: best quality, price as tiebreaker ──

    it('complex: should pick highest quality regardless of price', () => {
      const cheap = makeModel({
        model_name: 'cheap',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 1,
      });
      const expensive = makeModel({
        model_name: 'expensive',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        quality_score: 5,
      });

      expect(service.pickBest([cheap, expensive], 'complex')!.model_name).toBe('expensive');
    });

    it('complex: should use price as tiebreaker at same quality', () => {
      const cheapQ4 = makeModel({
        model_name: 'cheap-q4',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000015,
        quality_score: 4,
      });
      const expensiveQ4 = makeModel({
        model_name: 'expensive-q4',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        quality_score: 4,
      });

      expect(service.pickBest([expensiveQ4, cheapQ4], 'complex')!.model_name).toBe('cheap-q4');
    });

    // ── REASONING: best quality among reasoning models ──

    it('reasoning: should pick best reasoning model over cheaper non-reasoning', () => {
      const cheap = makeModel({
        model_name: 'cheap',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 2,
        capability_reasoning: false,
      });
      const reasoning = makeModel({
        model_name: 'reasoning',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        quality_score: 5,
        capability_reasoning: true,
      });

      expect(service.pickBest([cheap, reasoning], 'reasoning')!.model_name).toBe('reasoning');
    });

    it('reasoning: should fallback to complex logic when no reasoning models', () => {
      const lowQ = makeModel({
        model_name: 'low-q',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 1,
        capability_reasoning: false,
      });
      const highQ = makeModel({
        model_name: 'high-q',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        quality_score: 5,
        capability_reasoning: false,
      });

      expect(service.pickBest([lowQ, highQ], 'reasoning')!.model_name).toBe('high-q');
    });

    it('reasoning: should pick cheapest reasoning model at same quality', () => {
      const cheapR = makeModel({
        model_name: 'cheap-r',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000015,
        quality_score: 4,
        capability_reasoning: true,
      });
      const expensiveR = makeModel({
        model_name: 'expensive-r',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        quality_score: 4,
        capability_reasoning: true,
      });

      expect(service.pickBest([expensiveR, cheapR], 'reasoning')!.model_name).toBe('cheap-r');
    });

    // ── Real-world: single provider with multiple tiers ──

    it('should assign different models per tier (Gemini-like catalog)', () => {
      const flashLite = makeModel({
        model_name: 'gemini-2.5-flash-lite',
        provider: 'Google',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: 1,
      });
      const flash = makeModel({
        model_name: 'gemini-2.5-flash',
        provider: 'Google',
        input_price_per_token: 0.00000015,
        output_price_per_token: 0.0000006,
        quality_score: 2,
        capability_code: true,
      });
      const pro = makeModel({
        model_name: 'gemini-2.5-pro',
        provider: 'Google',
        input_price_per_token: 0.00000125,
        output_price_per_token: 0.00001,
        quality_score: 5,
        capability_reasoning: true,
        capability_code: true,
      });

      const models = [flashLite, flash, pro];

      expect(service.pickBest(models, 'simple')!.model_name).toBe('gemini-2.5-flash-lite');
      expect(service.pickBest(models, 'standard')!.model_name).toBe('gemini-2.5-flash');
      expect(service.pickBest(models, 'complex')!.model_name).toBe('gemini-2.5-pro');
      expect(service.pickBest(models, 'reasoning')!.model_name).toBe('gemini-2.5-pro');
    });

    it('should assign different models per tier (multi-provider catalog)', () => {
      const nano = makeModel({
        model_name: 'gpt-4.1-nano',
        provider: 'OpenAI',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000003,
        quality_score: 1,
      });
      const deepseekChat = makeModel({
        model_name: 'deepseek-chat',
        provider: 'DeepSeek',
        input_price_per_token: 0.00000014,
        output_price_per_token: 0.00000028,
        quality_score: 2,
        capability_code: true,
      });
      const opus = makeModel({
        model_name: 'claude-opus-4',
        provider: 'Anthropic',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
        quality_score: 5,
        capability_reasoning: true,
        capability_code: true,
      });
      const sonnet = makeModel({
        model_name: 'claude-sonnet-4',
        provider: 'Anthropic',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000015,
        quality_score: 4,
        capability_reasoning: true,
        capability_code: true,
      });

      const models = [nano, deepseekChat, opus, sonnet];

      expect(service.pickBest(models, 'simple')!.model_name).toBe('gpt-4.1-nano');
      expect(service.pickBest(models, 'standard')!.model_name).toBe('deepseek-chat');
      expect(service.pickBest(models, 'complex')!.model_name).toBe('claude-opus-4');
      expect(service.pickBest(models, 'reasoning')!.model_name).toBe('claude-opus-4');
    });

    it('should default quality_score to 3 when null', () => {
      const noQuality = makeModel({
        model_name: 'no-quality',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
        quality_score: null as unknown as number,
      });
      const highQ = makeModel({
        model_name: 'high-q',
        input_price_per_token: 0.00001,
        output_price_per_token: 0.00003,
        quality_score: 5,
      });

      // For complex tier: highest quality wins, null defaults to 3
      const result = service.pickBest([noQuality, highQ], 'complex');
      expect(result!.model_name).toBe('high-q');
      expect(result!.score).toBe(5);
    });

    it('should treat null quality_score as 3 for standard tier filtering', () => {
      const nullQ = makeModel({
        model_name: 'null-q',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000004,
        quality_score: null as unknown as number,
      });

      // Standard filters quality >= 2. null defaults to 3, so it should be eligible.
      const result = service.pickBest([nullQ], 'standard');
      expect(result!.model_name).toBe('null-q');
      expect(result!.score).toBe(3);
    });
  });

  describe('recalculate', () => {
    it('should assign a single model to all 4 tiers (one provider, one model)', async () => {
      mockProviderRepo.find.mockResolvedValue([{ provider: 'openai', is_active: true }]);
      const model = makeModel({ model_name: 'gpt-4o', provider: 'OpenAI' });
      mockPricingCache.getAll.mockReturnValue([model]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      for (const call of mockTierRepo.insert.mock.calls) {
        expect(call[0].auto_assigned_model).toBe('gpt-4o');
      }
    });

    it('should set all auto_assigned_model to null with no providers', async () => {
      mockProviderRepo.find.mockResolvedValue([]);
      mockPricingCache.getAll.mockReturnValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      for (const call of mockTierRepo.insert.mock.calls) {
        expect(call[0].auto_assigned_model).toBeNull();
      }
    });

    it('should save all 4 existing tiers when they already exist', async () => {
      mockProviderRepo.find.mockResolvedValue([{ provider: 'openai', is_active: true }]);
      const model = makeModel({ model_name: 'gpt-4o', provider: 'OpenAI' });
      mockPricingCache.getAll.mockReturnValue([model]);

      // All 4 tiers already exist
      mockTierRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        agent_id: 'agent-1',
        tier: 'simple',
        override_model: null,
        auto_assigned_model: null,
        updated_at: '2024-01-01',
      });

      await service.recalculate('agent-1');

      // Should save (not insert) all 4 existing tiers
      expect(mockTierRepo.save).toHaveBeenCalledTimes(4);
      expect(mockTierRepo.insert).not.toHaveBeenCalled();
      for (const call of mockTierRepo.save.mock.calls) {
        expect(call[0].auto_assigned_model).toBe('gpt-4o');
      }
    });

    it('should set auto_assigned_model to null when pickBest returns null for existing tier', async () => {
      mockProviderRepo.find.mockResolvedValue([{ provider: 'openai', is_active: true }]);
      // No models available (getAll returns empty array), so pickBest returns null
      mockPricingCache.getAll.mockReturnValue([]);

      // All 4 tiers already exist
      mockTierRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        agent_id: 'agent-1',
        tier: 'simple',
        override_model: null,
        auto_assigned_model: 'old-model',
        updated_at: '2024-01-01',
      });

      await service.recalculate('agent-1');

      // Should save with null auto_assigned_model (best?.model_name ?? null)
      expect(mockTierRepo.save).toHaveBeenCalledTimes(4);
      for (const call of mockTierRepo.save.mock.calls) {
        expect(call[0].auto_assigned_model).toBeNull();
      }
    });

    it('should preserve manual overrides during recalculation', async () => {
      const existingTier = {
        id: 'tier-1',
        agent_id: 'agent-1',
        tier: 'complex',
        override_model: 'claude-opus-4-6',
        auto_assigned_model: 'gpt-4o',
        updated_at: '2024-01-01',
      };
      mockTierRepo.findOne.mockResolvedValueOnce(existingTier);
      mockProviderRepo.find.mockResolvedValue([{ provider: 'openai', is_active: true }]);
      mockPricingCache.getAll.mockReturnValue([
        makeModel({ model_name: 'gpt-4o', provider: 'OpenAI' }),
      ]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          override_model: 'claude-opus-4-6',
          auto_assigned_model: 'gpt-4o',
        }),
      );
    });
  });
});
