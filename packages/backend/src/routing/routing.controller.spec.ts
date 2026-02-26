import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { ModelPricing } from '../entities/model-pricing.entity';
import * as telemetry from '../common/utils/product-telemetry';

jest.mock('../common/utils/product-telemetry', () => ({
  trackCloudEvent: jest.fn(),
}));

const mockUser = { id: 'user-1' } as never;

describe('RoutingController', () => {
  let controller: RoutingController;
  let mockRoutingService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;
  let mockOllamaSync: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoutingService = {
      getProviders: jest.fn().mockResolvedValue([]),
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: false }),
      removeProvider: jest.fn().mockResolvedValue({ notifications: 0 }),
      deactivateAllProviders: jest.fn().mockResolvedValue(undefined),
      getTiers: jest.fn().mockResolvedValue([]),
      setOverride: jest.fn().mockResolvedValue({}),
      clearOverride: jest.fn().mockResolvedValue(undefined),
      resetAllOverrides: jest.fn().mockResolvedValue(undefined),
      getKeyPrefix: jest.fn().mockReturnValue(null),
    };
    mockPricingCache = {
      getAll: jest.fn().mockReturnValue([]),
    };
    mockOllamaSync = {
      sync: jest.fn().mockResolvedValue({ count: 0 }),
    };

    controller = new RoutingController(
      mockRoutingService as unknown as RoutingService,
      mockPricingCache as unknown as ModelPricingCacheService,
      mockOllamaSync as unknown as OllamaSyncService,
    );
  });

  /* ── getStatus ── */

  describe('getStatus', () => {
    it('returns enabled true when at least one provider is active', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true },
      ]);

      const result = await controller.getStatus(mockUser);
      expect(result).toEqual({ enabled: true });
    });

    it('returns enabled false when no providers are active', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: false },
      ]);

      const result = await controller.getStatus(mockUser);
      expect(result).toEqual({ enabled: false });
    });

    it('returns enabled false when no providers exist', async () => {
      mockRoutingService.getProviders.mockResolvedValue([]);

      const result = await controller.getStatus(mockUser);
      expect(result).toEqual({ enabled: false });
    });

    it('returns enabled true with mixed active/inactive providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: false },
        { id: 'p2', provider: 'anthropic', is_active: true },
      ]);

      const result = await controller.getStatus(mockUser);
      expect(result).toEqual({ enabled: true });
    });
  });

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return mapped provider list', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true, connected_at: '2025-01-01', api_key_encrypted: 'enc' },
      ]);
      mockRoutingService.getKeyPrefix.mockReturnValue('sk-proj-');

      const result = await controller.getProviders(mockUser);

      expect(mockRoutingService.getProviders).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([
        { id: 'p1', provider: 'openai', is_active: true, has_api_key: true, key_prefix: 'sk-proj-', connected_at: '2025-01-01' },
      ]);
    });

    it('should strip internal fields from response', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true, connected_at: '2025-01-01', api_key_encrypted: 'secret', user_id: 'u1' },
      ]);
      mockRoutingService.getKeyPrefix.mockReturnValue('sk-proj-');

      const result = await controller.getProviders(mockUser);

      expect(result[0]).not.toHaveProperty('api_key_encrypted');
      expect(result[0]).not.toHaveProperty('user_id');
      expect(result[0]).toHaveProperty('has_api_key', true);
      expect(result[0]).toHaveProperty('key_prefix', 'sk-proj-');
    });

    it('should return empty array when no providers', async () => {
      const result = await controller.getProviders(mockUser);
      expect(result).toEqual([]);
    });
  });

  /* ── upsertProvider ── */

  describe('upsertProvider', () => {
    it('should call service and return mapped result (with apiKey)', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'anthropic', is_active: true, api_key_encrypted: 'enc' },
        isNew: true,
      });

      const result = await controller.upsertProvider(mockUser, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith('user-1', 'anthropic', 'sk-ant-test');
      expect(result).toEqual({ id: 'p1', provider: 'anthropic', is_active: true });
    });

    it('should call service without apiKey', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true, api_key_encrypted: null },
        isNew: false,
      });

      const result = await controller.upsertProvider(mockUser, {
        provider: 'openai',
      });

      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith('user-1', 'openai', undefined);
      expect(result).toEqual({ id: 'p1', provider: 'openai', is_active: true });
    });

    it('should fire routing_provider_connected when provider is new', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, { provider: 'openai', apiKey: 'sk-test' });

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_provider_connected',
        'user-1',
        { provider: 'openai' },
      );
    });

    it('should not fire event when provider already exists', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true },
        isNew: false,
      });

      await controller.upsertProvider(mockUser, { provider: 'openai', apiKey: 'sk-test' });

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
    });

    it('should fire event for new provider even without apiKey', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'anthropic', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, { provider: 'anthropic' });

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_provider_connected',
        'user-1',
        { provider: 'anthropic' },
      );
    });

    it('should pass body.provider to trackCloudEvent, not result.provider', async () => {
      // Simulate a case where the body provider name differs in casing
      // from the stored result provider name
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'OpenAI', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, { provider: 'openai', apiKey: 'sk-test' });

      // The event should use body.provider ('openai'), not result.provider ('OpenAI')
      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_provider_connected',
        'user-1',
        { provider: 'openai' },
      );
    });

    it('should not expose api_key_encrypted in response', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: {
          id: 'p1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: 'secret-encrypted-value',
          user_id: 'user-1',
          connected_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        isNew: true,
      });

      const result = await controller.upsertProvider(mockUser, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(result).toEqual({ id: 'p1', provider: 'openai', is_active: true });
      expect(result).not.toHaveProperty('api_key_encrypted');
      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('connected_at');
      expect(result).not.toHaveProperty('updated_at');
    });

    it('should pass user.id to trackCloudEvent as tenantId', async () => {
      const customUser = { id: 'custom-user-id-123' } as never;
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(customUser, { provider: 'openai' });

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_provider_connected',
        'custom-user-id-123',
        { provider: 'openai' },
      );
    });
  });

  /* ── deactivateAllProviders ── */

  describe('deactivateAllProviders', () => {
    it('should return ok after deactivating all', async () => {
      const result = await controller.deactivateAllProviders(mockUser);

      expect(mockRoutingService.deactivateAllProviders).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ ok: true });
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

  /* ── syncOllama ── */

  describe('syncOllama', () => {
    it('should delegate to ollamaSync service', async () => {
      const result = await controller.syncOllama();
      expect(mockOllamaSync.sync).toHaveBeenCalled();
      expect(result).toEqual({ count: 0 });
    });
  });

  /* ── upsertProvider with Ollama ── */

  describe('upsertProvider (ollama)', () => {
    it('should sync ollama models before connecting', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'ollama', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, { provider: 'ollama' });

      expect(mockOllamaSync.sync).toHaveBeenCalled();
      expect(mockRoutingService.upsertProvider).toHaveBeenCalled();
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
