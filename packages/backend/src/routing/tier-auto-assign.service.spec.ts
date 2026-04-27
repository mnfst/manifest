import { TierAutoAssignService } from './routing-core/tier-auto-assign.service';
import { DiscoveredModel } from '../model-discovery/model-fetcher';

function makeModel(overrides: Partial<DiscoveredModel>): DiscoveredModel {
  return {
    id: 'test-model',
    displayName: 'Test Model',
    provider: 'TestProvider',
    contextWindow: 128000,
    inputPricePerToken: 0.00001,
    outputPricePerToken: 0.00003,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
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
  let mockDiscoveryService: { getModelsForAgent: jest.Mock };
  let mockTierRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    mockDiscoveryService = {
      getModelsForAgent: jest.fn().mockResolvedValue([]),
    };
    mockTierRepo = makeMockRepo();

    service = new TierAutoAssignService(mockDiscoveryService as never, mockTierRepo as never);
  });

  describe('pickBest', () => {
    it('should return null for empty model list', () => {
      expect(service.pickBest([], 'simple')).toBeNull();
    });

    it('should pick free models (e.g. local Ollama)', () => {
      const free = makeModel({
        id: 'free',
        inputPricePerToken: 0,
        outputPricePerToken: 0,
      });
      expect(service.pickBest([free], 'simple')!.model_name).toBe('free');
    });

    // ── SIMPLE: cheapest wins ──

    it('simple: should pick cheapest model', () => {
      const cheap = makeModel({
        id: 'cheap',
        inputPricePerToken: 0.000001,
        outputPricePerToken: 0.000002,
        qualityScore: 1,
      });
      const expensive = makeModel({
        id: 'expensive',
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.00003,
        qualityScore: 5,
      });

      expect(service.pickBest([cheap, expensive], 'simple')!.model_name).toBe('cheap');
    });

    it('simple: quality does not matter', () => {
      const lowQ = makeModel({
        id: 'low-q',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
      });
      const highQ = makeModel({
        id: 'high-q',
        inputPricePerToken: 0.0000002,
        outputPricePerToken: 0.0000008,
        qualityScore: 5,
      });

      expect(service.pickBest([lowQ, highQ], 'simple')!.model_name).toBe('low-q');
    });

    // ── STANDARD: cheapest among quality >= 2 ──

    it('standard: should exclude quality 1 models', () => {
      const ultraCheap = makeModel({
        id: 'ultra-cheap',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
      });
      const decent = makeModel({
        id: 'decent',
        inputPricePerToken: 0.000001,
        outputPricePerToken: 0.000002,
        qualityScore: 2,
      });

      expect(service.pickBest([ultraCheap, decent], 'standard')!.model_name).toBe('decent');
    });

    it('standard: should fallback to cheapest if all are quality 1', () => {
      const a = makeModel({
        id: 'a',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
      });
      const b = makeModel({
        id: 'b',
        inputPricePerToken: 0.0000002,
        outputPricePerToken: 0.0000008,
        qualityScore: 1,
      });

      expect(service.pickBest([a, b], 'standard')!.model_name).toBe('a');
    });

    // ── COMPLEX: best quality, price as tiebreaker ──

    it('complex: should pick highest quality regardless of price', () => {
      const cheap = makeModel({
        id: 'cheap',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
      });
      const expensive = makeModel({
        id: 'expensive',
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        qualityScore: 5,
      });

      expect(service.pickBest([cheap, expensive], 'complex')!.model_name).toBe('expensive');
    });

    it('complex: should use price as tiebreaker at same quality', () => {
      const cheapQ4 = makeModel({
        id: 'cheap-q4',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
      });
      const expensiveQ4 = makeModel({
        id: 'expensive-q4',
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        qualityScore: 4,
      });

      expect(service.pickBest([expensiveQ4, cheapQ4], 'complex')!.model_name).toBe('cheap-q4');
    });

    // ── REASONING: best quality among reasoning models ──

    it('reasoning: should pick best reasoning model over cheaper non-reasoning', () => {
      const cheap = makeModel({
        id: 'cheap',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 2,
        capabilityReasoning: false,
      });
      const reasoning = makeModel({
        id: 'reasoning',
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        qualityScore: 5,
        capabilityReasoning: true,
      });

      expect(service.pickBest([cheap, reasoning], 'reasoning')!.model_name).toBe('reasoning');
    });

    it('reasoning: should fallback to complex logic when no reasoning models', () => {
      const lowQ = makeModel({
        id: 'low-q',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
        capabilityReasoning: false,
      });
      const highQ = makeModel({
        id: 'high-q',
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        qualityScore: 5,
        capabilityReasoning: false,
      });

      expect(service.pickBest([lowQ, highQ], 'reasoning')!.model_name).toBe('high-q');
    });

    it('reasoning: should pick cheapest reasoning model at same quality', () => {
      const cheapR = makeModel({
        id: 'cheap-r',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
        capabilityReasoning: true,
      });
      const expensiveR = makeModel({
        id: 'expensive-r',
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        qualityScore: 4,
        capabilityReasoning: true,
      });

      expect(service.pickBest([expensiveR, cheapR], 'reasoning')!.model_name).toBe('cheap-r');
    });

    // ── Real-world: single provider with multiple tiers ──

    it('should assign different models per tier (Gemini-like catalog)', () => {
      const flashLite = makeModel({
        id: 'gemini-2.5-flash-lite',
        provider: 'Google',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
      });
      const flash = makeModel({
        id: 'gemini-2.5-flash',
        provider: 'Google',
        inputPricePerToken: 0.00000015,
        outputPricePerToken: 0.0000006,
        qualityScore: 2,
        capabilityCode: true,
      });
      const pro = makeModel({
        id: 'gemini-2.5-pro',
        provider: 'Google',
        inputPricePerToken: 0.00000125,
        outputPricePerToken: 0.00001,
        qualityScore: 5,
        capabilityReasoning: true,
        capabilityCode: true,
      });

      const models = [flashLite, flash, pro];

      expect(service.pickBest(models, 'simple')!.model_name).toBe('gemini-2.5-flash-lite');
      expect(service.pickBest(models, 'standard')!.model_name).toBe('gemini-2.5-flash');
      expect(service.pickBest(models, 'complex')!.model_name).toBe('gemini-2.5-pro');
      expect(service.pickBest(models, 'reasoning')!.model_name).toBe('gemini-2.5-pro');
    });

    it('should assign different models per tier (multi-provider catalog)', () => {
      const nano = makeModel({
        id: 'gpt-4.1-nano',
        provider: 'OpenAI',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000003,
        qualityScore: 1,
      });
      const deepseekChat = makeModel({
        id: 'deepseek-chat',
        provider: 'DeepSeek',
        inputPricePerToken: 0.00000014,
        outputPricePerToken: 0.00000028,
        qualityScore: 2,
        capabilityCode: true,
      });
      const opus = makeModel({
        id: 'claude-opus-4',
        provider: 'Anthropic',
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        qualityScore: 5,
        capabilityReasoning: true,
        capabilityCode: true,
      });
      const sonnet = makeModel({
        id: 'claude-sonnet-4',
        provider: 'Anthropic',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
        capabilityReasoning: true,
        capabilityCode: true,
      });

      const models = [nano, deepseekChat, opus, sonnet];

      expect(service.pickBest(models, 'simple')!.model_name).toBe('gpt-4.1-nano');
      expect(service.pickBest(models, 'standard')!.model_name).toBe('deepseek-chat');
      expect(service.pickBest(models, 'complex')!.model_name).toBe('claude-opus-4');
      expect(service.pickBest(models, 'reasoning')!.model_name).toBe('claude-opus-4');
    });

    it('should default qualityScore to 3 when null', () => {
      const noQuality = makeModel({
        id: 'no-quality',
        inputPricePerToken: 0.000001,
        outputPricePerToken: 0.000002,
        qualityScore: null as unknown as number,
      });
      const highQ = makeModel({
        id: 'high-q',
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.00003,
        qualityScore: 5,
      });

      // For complex tier: highest quality wins, null defaults to 3
      const result = service.pickBest([noQuality, highQ], 'complex');
      expect(result!.model_name).toBe('high-q');
      expect(result!.score).toBe(5);
    });

    it('should treat null qualityScore as 3 for standard tier filtering', () => {
      const nullQ = makeModel({
        id: 'null-q',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: null as unknown as number,
      });

      // Standard filters quality >= 2. null defaults to 3, so it should be eligible.
      const result = service.pickBest([nullQ], 'standard');
      expect(result!.model_name).toBe('null-q');
      expect(result!.score).toBe(3);
    });

    it('should deprioritize null inputPricePerToken (unknown cost)', () => {
      const nullInput = makeModel({
        id: 'null-input',
        inputPricePerToken: null,
        outputPricePerToken: 0.000002,
        qualityScore: 3,
      });
      const priced = makeModel({
        id: 'priced',
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.000002,
        qualityScore: 3,
      });

      // null pricing = unknown cost, priced model wins cheapest-first
      expect(service.pickBest([nullInput, priced], 'simple')!.model_name).toBe('priced');
    });

    it('should deprioritize null outputPricePerToken (unknown cost)', () => {
      const nullOutput = makeModel({
        id: 'null-output',
        inputPricePerToken: 0.000001,
        outputPricePerToken: null,
        qualityScore: 3,
      });
      const priced = makeModel({
        id: 'priced',
        inputPricePerToken: 0.000001,
        outputPricePerToken: 0.00003,
        qualityScore: 3,
      });

      // null pricing = unknown cost, priced model wins cheapest-first
      expect(service.pickBest([nullOutput, priced], 'simple')!.model_name).toBe('priced');
    });

    it('should still pick null-priced model when it is the only option', () => {
      const nullPriced = makeModel({
        id: 'null-priced',
        inputPricePerToken: null,
        outputPricePerToken: null,
        qualityScore: 3,
      });

      expect(service.pickBest([nullPriced], 'simple')!.model_name).toBe('null-priced');
    });

    it('should prefer priced model over null-priced for simple tier', () => {
      const gemma = makeModel({
        id: 'gemma-3-1b',
        inputPricePerToken: null,
        outputPricePerToken: null,
        qualityScore: 2,
      });
      const flash = makeModel({
        id: 'gemini-2.0-flash',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 2,
        capabilityCode: true,
      });

      expect(service.pickBest([gemma, flash], 'simple')!.model_name).toBe('gemini-2.0-flash');
    });
  });

  describe('recalculate', () => {
    it('should assign a single model to all 4 tiers (one provider, one model)', async () => {
      const model = makeModel({ id: 'gpt-4o', provider: 'OpenAI' });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([model]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      expect(inserted).toHaveLength(5);
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('gpt-4o');
      }
    });

    it('should set all auto_assigned_model to null with no models', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string | null;
      }[];
      expect(inserted).toHaveLength(5);
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBeNull();
      }
    });

    it('should save all 4 existing tiers when they already exist', async () => {
      const model = makeModel({ id: 'gpt-4o', provider: 'OpenAI' });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([model]);

      mockTierRepo.find.mockResolvedValue(
        ['simple', 'standard', 'complex', 'reasoning', 'default'].map((tier) => ({
          id: `existing-${tier}`,
          agent_id: 'agent-1',
          tier,
          override_model: null,
          auto_assigned_model: null,
          updated_at: '2024-01-01',
        })),
      );

      await service.recalculate('agent-1');

      expect(mockTierRepo.save).toHaveBeenCalledTimes(1);
      expect(mockTierRepo.insert).not.toHaveBeenCalled();
      const saved = mockTierRepo.save.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      expect(saved).toHaveLength(5);
      for (const record of saved) {
        expect(record.auto_assigned_model).toBe('gpt-4o');
      }
    });

    it('should set auto_assigned_model to null when pickBest returns null for existing tier', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([]);

      mockTierRepo.find.mockResolvedValue(
        ['simple', 'standard', 'complex', 'reasoning', 'default'].map((tier) => ({
          id: `existing-${tier}`,
          agent_id: 'agent-1',
          tier,
          override_model: null,
          auto_assigned_model: 'old-model',
          updated_at: '2024-01-01',
        })),
      );

      await service.recalculate('agent-1');

      expect(mockTierRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockTierRepo.save.mock.calls[0][0] as {
        auto_assigned_model: string | null;
      }[];
      expect(saved).toHaveLength(5);
      for (const record of saved) {
        expect(record.auto_assigned_model).toBeNull();
      }
    });

    it('should prioritize subscription models over api_key models', async () => {
      const geminiFlash = makeModel({
        id: 'gemini-2.5-flash',
        provider: 'Google',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 2,
        authType: 'api_key',
      });
      const claudeSonnet = makeModel({
        id: 'claude-sonnet-4',
        provider: 'Anthropic',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
        authType: 'subscription',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([geminiFlash, claudeSonnet]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      // All tiers should pick from subscription (Anthropic) even though Gemini is cheaper
      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      expect(inserted).toHaveLength(5);
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('claude-sonnet-4');
      }
    });

    it('should fall back to api_key models when no subscription models available', async () => {
      const gpt4o = makeModel({
        id: 'gpt-4o',
        provider: 'OpenAI',
        qualityScore: 4,
        authType: 'api_key',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([gpt4o]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      expect(inserted).toHaveLength(5);
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('gpt-4o');
      }
    });

    it('should use subscription models even when api_key models are cheaper', async () => {
      const cheapOpenAI = makeModel({
        id: 'gpt-4.1-nano',
        provider: 'OpenAI',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000003,
        qualityScore: 1,
        authType: 'api_key',
      });
      const expensiveSub = makeModel({
        id: 'claude-sonnet-4',
        provider: 'Anthropic',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
        authType: 'subscription',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([cheapOpenAI, expensiveSub]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      expect(inserted).toHaveLength(5);
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('claude-sonnet-4');
      }
    });

    it('should split models by authType field for subscription prioritization', async () => {
      const claude = makeModel({
        id: 'claude-sonnet-4',
        provider: 'Anthropic',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
        authType: 'subscription',
      });
      const gemini = makeModel({
        id: 'gemini-2.5-flash',
        provider: 'Google',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 2,
        authType: 'subscription',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([claude, gemini]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        tier: string;
        auto_assigned_model: string;
      }[];

      // Simple tier picks cheapest subscription model = gemini-2.5-flash
      const simpleTier = inserted.find((t) => t.tier === 'simple');
      expect(simpleTier).toBeDefined();
      expect(simpleTier!.auto_assigned_model).toBe('gemini-2.5-flash');

      // Complex tier picks highest quality subscription model = claude-sonnet-4
      const complexTier = inserted.find((t) => t.tier === 'complex');
      expect(complexTier).toBeDefined();
      expect(complexTier!.auto_assigned_model).toBe('claude-sonnet-4');
    });

    it('should treat models without authType as api_key', async () => {
      const orModel = makeModel({
        id: 'anthropic/claude-sonnet-4',
        provider: 'OpenRouter',
        qualityScore: 4,
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([orModel]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string | null;
      }[];
      // OpenRouter model provider doesn't match 'anthropic', so it goes to keyModels
      // But there are no api_key providers, so subModels picks from empty set = null
      // keyModels has the OR model, so it falls back there
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('anthropic/claude-sonnet-4');
      }
    });

    it('should assign null when no models available', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string | null;
      }[];
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBeNull();
      }
    });

    it('should treat models with api_key authType as non-subscription', async () => {
      const orModel = makeModel({
        id: 'anthropic/claude-sonnet-4',
        provider: 'OpenRouter',
        qualityScore: 4,
        authType: 'api_key',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([orModel]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('anthropic/claude-sonnet-4');
      }
    });

    it('should preserve manual overrides during recalculation', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeModel({ id: 'gpt-4o', provider: 'OpenAI' }),
      ]);

      // Batch find returns one existing tier with override
      mockTierRepo.find.mockResolvedValue([
        {
          id: 'tier-1',
          agent_id: 'agent-1',
          tier: 'complex',
          override_model: 'claude-opus-4-6',
          auto_assigned_model: 'gpt-4o',
          updated_at: '2024-01-01',
        },
      ]);

      await service.recalculate('agent-1');

      // Save call includes the existing tier; insert call includes the 3 missing tiers
      expect(mockTierRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockTierRepo.save.mock.calls[0][0] as Record<string, unknown>[];
      const complexTier = saved.find((t: Record<string, unknown>) => t['tier'] === 'complex');
      expect(complexTier).toEqual(
        expect.objectContaining({
          override_model: 'claude-opus-4-6',
          auto_assigned_model: 'gpt-4o',
        }),
      );
    });

    it('should only use zero-cost models for OpenAI subscription (Codex)', async () => {
      const codexModel = makeModel({
        id: 'gpt-5.3-codex',
        provider: 'OpenAI',
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        qualityScore: 4,
        capabilityReasoning: true,
        authType: 'subscription',
      });
      const paidModel = makeModel({
        id: 'gpt-4.1-nano',
        provider: 'OpenAI',
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000004,
        qualityScore: 1,
        authType: 'subscription',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([codexModel, paidModel]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      // All tiers should use Codex model (zero cost), not gpt-4.1-nano (paid)
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('gpt-5.3-codex');
      }
    });

    it('should not treat null-priced subscription models as zero-cost', async () => {
      const nullPricedModel = makeModel({
        id: 'gemma-3-1b',
        provider: 'Google',
        inputPricePerToken: null,
        outputPricePerToken: null,
        qualityScore: 2,
        authType: 'subscription',
      });
      const paidModel = makeModel({
        id: 'gemini-2.5-flash',
        provider: 'Google',
        inputPricePerToken: 0.0000003,
        outputPricePerToken: 0.0000025,
        qualityScore: 2,
        capabilityCode: true,
        authType: 'subscription',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([nullPricedModel, paidModel]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        tier: string;
        auto_assigned_model: string;
      }[];
      // Simple tier should pick gemini-2.5-flash (known price), not gemma-3-1b (null price)
      const simpleTier = inserted.find((t) => t.tier === 'simple');
      expect(simpleTier!.auto_assigned_model).toBe('gemini-2.5-flash');
    });

    it('should keep all models for providers without zero-cost models (Anthropic)', async () => {
      const sonnet = makeModel({
        id: 'claude-sonnet-4',
        provider: 'Anthropic',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        qualityScore: 4,
        authType: 'subscription',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([sonnet]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('claude-sonnet-4');
      }
    });

    it('should use authType field from models to separate subscription and api_key', async () => {
      const subModel = makeModel({
        id: 'claude-sonnet-4',
        provider: 'Anthropic',
        qualityScore: 4,
        authType: 'subscription',
      });
      const keyModel = makeModel({
        id: 'gpt-4o',
        provider: 'OpenAI',
        qualityScore: 3,
        authType: 'api_key',
      });
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([subModel, keyModel]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.recalculate('agent-1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = mockTierRepo.insert.mock.calls[0][0] as {
        auto_assigned_model: string;
      }[];
      // Subscription models are prioritized — claude-sonnet-4 should win all tiers
      for (const record of inserted) {
        expect(record.auto_assigned_model).toBe('claude-sonnet-4');
      }
    });
  });
});
