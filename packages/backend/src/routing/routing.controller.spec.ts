import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { ModelPricing } from '../entities/model-pricing.entity';

const mockUser = { id: 'user-1' } as never;

describe('RoutingController', () => {
  let controller: RoutingController;
  let mockRoutingService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRoutingService = {
      getProviders: jest.fn().mockResolvedValue([]),
      upsertProvider: jest.fn().mockResolvedValue({}),
      removeProvider: jest.fn().mockResolvedValue({ notifications: 0 }),
      getTiers: jest.fn().mockResolvedValue([]),
      setOverride: jest.fn().mockResolvedValue({}),
      clearOverride: jest.fn().mockResolvedValue(undefined),
      resetAllOverrides: jest.fn().mockResolvedValue(undefined),
      bulkSaveTiers: jest.fn().mockResolvedValue([]),
      getPresetRecommendations: jest.fn().mockResolvedValue({}),
    };
    mockPricingCache = {
      getAll: jest.fn().mockReturnValue([]),
    };

    controller = new RoutingController(
      mockRoutingService as unknown as RoutingService,
      mockPricingCache as unknown as ModelPricingCacheService,
    );
  });

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return mapped provider list', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true, connected_at: '2025-01-01', api_key_encrypted: 'enc' },
      ]);

      const result = await controller.getProviders(mockUser);

      expect(mockRoutingService.getProviders).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([
        { id: 'p1', provider: 'openai', is_active: true, connected_at: '2025-01-01' },
      ]);
    });

    it('should strip internal fields from response', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true, connected_at: '2025-01-01', api_key_encrypted: 'secret', user_id: 'u1' },
      ]);

      const result = await controller.getProviders(mockUser);

      expect(result[0]).not.toHaveProperty('api_key_encrypted');
      expect(result[0]).not.toHaveProperty('user_id');
    });

    it('should return empty array when no providers', async () => {
      const result = await controller.getProviders(mockUser);
      expect(result).toEqual([]);
    });
  });

  /* ── upsertProvider ── */

  describe('upsertProvider', () => {
    it('should call service and return mapped result', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        id: 'p1', provider: 'anthropic', is_active: true, api_key_encrypted: 'enc',
      });

      const result = await controller.upsertProvider(mockUser, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith('user-1', 'anthropic', 'sk-ant-test');
      expect(result).toEqual({ id: 'p1', provider: 'anthropic', is_active: true });
    });
  });

  /* ── removeProvider ── */

  describe('removeProvider', () => {
    it('should return ok with notification count', async () => {
      mockRoutingService.removeProvider.mockResolvedValue({ notifications: 3 });

      const result = await controller.removeProvider(mockUser, { provider: 'openai' });

      expect(mockRoutingService.removeProvider).toHaveBeenCalledWith('user-1', 'openai');
      expect(result).toEqual({ ok: true, notifications: 3 });
    });

    it('should return zero notifications when none cleared', async () => {
      mockRoutingService.removeProvider.mockResolvedValue({ notifications: 0 });

      const result = await controller.removeProvider(mockUser, { provider: 'deepseek' });
      expect(result).toEqual({ ok: true, notifications: 0 });
    });
  });

  /* ── getTiers ── */

  describe('getTiers', () => {
    it('should delegate to service', async () => {
      const tiers = [
        { tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o' },
      ];
      mockRoutingService.getTiers.mockResolvedValue(tiers);

      const result = await controller.getTiers(mockUser);

      expect(mockRoutingService.getTiers).toHaveBeenCalledWith('user-1');
      expect(result).toBe(tiers);
    });
  });

  /* ── setOverride ── */

  describe('setOverride', () => {
    it('should call service with tier and model', async () => {
      const updated = { tier: 'complex', override_model: 'claude-opus-4-6' };
      mockRoutingService.setOverride.mockResolvedValue(updated);

      const result = await controller.setOverride(
        mockUser,
        { tier: 'complex' },
        { model: 'claude-opus-4-6' },
      );

      expect(mockRoutingService.setOverride).toHaveBeenCalledWith('user-1', 'complex', 'claude-opus-4-6');
      expect(result).toBe(updated);
    });
  });

  /* ── clearOverride ── */

  describe('clearOverride', () => {
    it('should return ok after clearing', async () => {
      const result = await controller.clearOverride(mockUser, { tier: 'simple' });

      expect(mockRoutingService.clearOverride).toHaveBeenCalledWith('user-1', 'simple');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── resetAllOverrides ── */

  describe('resetAllOverrides', () => {
    it('should return ok after resetting', async () => {
      const result = await controller.resetAllOverrides(mockUser);

      expect(mockRoutingService.resetAllOverrides).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── bulkSaveTiers ── */

  describe('bulkSaveTiers', () => {
    it('should call service with correct args', async () => {
      const tiers = [
        { tier: 'complex', override_model: 'claude-opus-4-6', auto_assigned_model: 'gpt-4o' },
      ];
      mockRoutingService.bulkSaveTiers.mockResolvedValue(tiers);

      const result = await controller.bulkSaveTiers(mockUser, {
        tiers: [
          { tier: 'complex', model: 'claude-opus-4-6' },
          { tier: 'simple', model: null },
        ],
      });

      expect(mockRoutingService.bulkSaveTiers).toHaveBeenCalledWith('user-1', [
        { tier: 'complex', model: 'claude-opus-4-6' },
        { tier: 'simple', model: null },
      ], undefined, undefined);
      expect(result).toBe(tiers);
    });

    it('should pass preset and fromPreset to service when provided', async () => {
      mockRoutingService.bulkSaveTiers.mockResolvedValue([]);

      await controller.bulkSaveTiers(mockUser, {
        tiers: [{ tier: 'simple', model: null }],
        preset: 'eco',
        fromPreset: 'custom',
      });

      expect(mockRoutingService.bulkSaveTiers).toHaveBeenCalledWith(
        'user-1',
        [{ tier: 'simple', model: null }],
        'eco',
        'custom',
      );
    });
  });

  /* ── getPresets ── */

  describe('getPresets', () => {
    it('should return preset recommendations', async () => {
      const recommendations = {
        eco: { simple: 'cheap-model', standard: 'cheap-model', complex: 'cheap-model', reasoning: 'cheap-model' },
        balanced: { simple: 'cheap-model', standard: 'mid-model', complex: 'top-model', reasoning: 'top-model' },
        quality: { simple: 'top-model', standard: 'top-model', complex: 'top-model', reasoning: 'top-model' },
        fast: { simple: 'fast-model', standard: 'fast-model', complex: 'fast-model', reasoning: 'fast-model' },
      };
      mockRoutingService.getPresetRecommendations.mockResolvedValue(recommendations);

      const result = await controller.getPresets(mockUser);

      expect(mockRoutingService.getPresetRecommendations).toHaveBeenCalledWith('user-1');
      expect(result).toBe(recommendations);
    });
  });

  /* ── getAvailableModels ── */

  describe('getAvailableModels', () => {
    function makePricing(overrides: Partial<ModelPricing>): ModelPricing {
      return {
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
        context_window: 128000,
        capability_reasoning: false,
        capability_code: true,
        quality_score: 3,
        ...overrides,
      } as ModelPricing;
    }

    it('should filter models by active providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openai', is_active: true },
        { provider: 'anthropic', is_active: false },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI' }),
        makePricing({ model_name: 'claude-opus-4-6', provider: 'Anthropic' }),
      ]);

      const result = await controller.getAvailableModels(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].model_name).toBe('gpt-4o');
    });

    it('should expand provider aliases (gemini ↔ google)', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'gemini', is_active: true },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gemini-2.5-pro', provider: 'Google' }),
      ]);

      const result = await controller.getAvailableModels(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].model_name).toBe('gemini-2.5-pro');
    });

    it('should return empty array when no active providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openai', is_active: false },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI' }),
      ]);

      const result = await controller.getAvailableModels(mockUser);
      expect(result).toEqual([]);
    });

    it('should return only whitelisted fields', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openai', is_active: true },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI' }),
      ]);

      const result = await controller.getAvailableModels(mockUser);

      expect(Object.keys(result[0]).sort()).toEqual([
        'capability_code',
        'capability_reasoning',
        'context_window',
        'input_price_per_token',
        'model_name',
        'output_price_per_token',
        'provider',
        'quality_score',
      ]);
    });

    it('should include models from multiple active providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openai', is_active: true },
        { provider: 'xai', is_active: true },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI' }),
        makePricing({ model_name: 'grok-3', provider: 'xAI' }),
        makePricing({ model_name: 'claude-opus-4-6', provider: 'Anthropic' }),
      ]);

      const result = await controller.getAvailableModels(mockUser);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.model_name).sort()).toEqual(['gpt-4o', 'grok-3']);
    });
  });
});
