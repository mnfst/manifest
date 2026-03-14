import { NotFoundException } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ResolveAgentService } from './resolve-agent.service';
import { CustomProviderService } from './custom-provider.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { ModelPricing } from '../entities/model-pricing.entity';
import { Agent } from '../entities/agent.entity';
import * as telemetry from '../common/utils/product-telemetry';

jest.mock('../common/utils/product-telemetry', () => ({
  trackCloudEvent: jest.fn(),
}));

const mockUser = { id: 'user-1' } as never;
const mockAgentName = { agentName: 'test-agent' } as never;
const TEST_AGENT_ID = 'agent-001';

describe('RoutingController', () => {
  let controller: RoutingController;
  let mockRoutingService: Record<string, jest.Mock>;
  let mockCustomProviderService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;
  let mockOllamaSync: Record<string, jest.Mock>;
  let mockResolveAgent: Record<string, jest.Mock>;

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
      getFallbacks: jest.fn().mockResolvedValue([]),
      setFallbacks: jest.fn().mockResolvedValue([]),
      clearFallbacks: jest.fn().mockResolvedValue(undefined),
    };
    mockPricingCache = {
      getAll: jest.fn().mockReturnValue([]),
    };
    mockOllamaSync = {
      sync: jest.fn().mockResolvedValue({ count: 0 }),
    };
    mockResolveAgent = {
      resolve: jest.fn().mockResolvedValue({ id: TEST_AGENT_ID, name: 'test-agent' } as Agent),
    };
    mockCustomProviderService = {
      list: jest.fn().mockResolvedValue([]),
    };

    controller = new RoutingController(
      mockRoutingService as unknown as RoutingService,
      mockCustomProviderService as unknown as CustomProviderService,
      mockPricingCache as unknown as ModelPricingCacheService,
      mockOllamaSync as unknown as OllamaSyncService,
      mockResolveAgent as unknown as ResolveAgentService,
    );
  });

  /* ── getStatus ── */

  describe('getStatus', () => {
    it('returns enabled true when at least one provider is active', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true },
      ]);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: true });
    });

    it('returns enabled false when no providers are active', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: false },
      ]);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: false });
    });

    it('returns enabled false when no providers exist', async () => {
      mockRoutingService.getProviders.mockResolvedValue([]);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: false });
    });

    it('returns enabled true with mixed active/inactive providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: false },
        { id: 'p2', provider: 'anthropic', is_active: true },
      ]);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: true });
    });
  });

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return mapped provider list', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        {
          id: 'p1',
          provider: 'openai',
          is_active: true,
          connected_at: '2025-01-01',
          api_key_encrypted: 'enc',
          key_prefix: 'sk-proj-',
        },
      ]);

      const result = await controller.getProviders(mockUser, mockAgentName);

      expect(mockRoutingService.getProviders).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual([
        {
          id: 'p1',
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
          has_api_key: true,
          key_prefix: 'sk-proj-',
          connected_at: '2025-01-01',
        },
      ]);
    });

    it('should strip internal fields from response', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        {
          id: 'p1',
          provider: 'openai',
          is_active: true,
          connected_at: '2025-01-01',
          api_key_encrypted: 'secret',
          key_prefix: 'sk-proj-',
          agent_id: 'a1',
        },
      ]);

      const result = await controller.getProviders(mockUser, mockAgentName);

      expect(result[0]).not.toHaveProperty('api_key_encrypted');
      expect(result[0]).not.toHaveProperty('agent_id');
      expect(result[0]).toHaveProperty('has_api_key', true);
      expect(result[0]).toHaveProperty('key_prefix', 'sk-proj-');
    });

    it('should return empty array when no providers', async () => {
      const result = await controller.getProviders(mockUser, mockAgentName);
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

      const result = await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'user-1',
        'anthropic',
        'sk-ant-test',
        undefined,
      );
      expect(result).toEqual({
        id: 'p1',
        provider: 'anthropic',
        auth_type: 'api_key',
        is_active: true,
      });
    });

    it('should call service without apiKey', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true, api_key_encrypted: null },
        isNew: false,
      });

      const result = await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
      });

      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'user-1',
        'openai',
        undefined,
        undefined,
      );
      expect(result).toEqual({
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
    });

    it('should fire routing_provider_connected when provider is new', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_provider_connected',
        'user-1',
        { provider: 'openai' },
      );
    });

    it('should append (Subscription) to provider label for subscription auth type', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'anthropic', is_active: true, auth_type: 'subscription' },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'anthropic',
        authType: 'subscription',
      });

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_provider_connected',
        'user-1',
        { provider: 'anthropic (Subscription)' },
      );
    });

    it('should not fire event when provider already exists', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true },
        isNew: false,
      });

      await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
    });

    it('should not expose api_key_encrypted in response', async () => {
      mockRoutingService.upsertProvider.mockResolvedValue({
        provider: {
          id: 'p1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: 'secret-encrypted-value',
          agent_id: 'a1',
          connected_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        isNew: true,
      });

      const result = await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(result).toEqual({
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      expect(result).not.toHaveProperty('api_key_encrypted');
      expect(result).not.toHaveProperty('agent_id');
    });
  });

  /* ── deactivateAllProviders ── */

  describe('deactivateAllProviders', () => {
    it('should return ok after deactivating all', async () => {
      const result = await controller.deactivateAllProviders(mockUser, mockAgentName);

      expect(mockRoutingService.deactivateAllProviders).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── removeProvider ── */

  describe('removeProvider', () => {
    it('should return ok with notification count', async () => {
      mockRoutingService.removeProvider.mockResolvedValue({ notifications: 3 });

      const result = await controller.removeProvider(
        mockUser,
        { agentName: 'test-agent', provider: 'openai' } as never,
        {} as never,
      );

      expect(mockRoutingService.removeProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'openai',
        undefined,
      );
      expect(result).toEqual({ ok: true, notifications: 3 });
    });

    it('should return zero notifications when none cleared', async () => {
      mockRoutingService.removeProvider.mockResolvedValue({ notifications: 0 });

      const result = await controller.removeProvider(
        mockUser,
        { agentName: 'test-agent', provider: 'deepseek' } as never,
        {} as never,
      );
      expect(result).toEqual({ ok: true, notifications: 0 });
    });

    it('should pass authType to service when provided', async () => {
      mockRoutingService.removeProvider.mockResolvedValue({ notifications: [] });

      await controller.removeProvider(
        mockUser,
        { agentName: 'test-agent', provider: 'anthropic' } as never,
        { authType: 'subscription' } as never,
      );

      expect(mockRoutingService.removeProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'anthropic',
        'subscription',
      );
    });
  });

  /* ── getTiers ── */

  describe('getTiers', () => {
    it('should delegate to service', async () => {
      const tiers = [{ tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o' }];
      mockRoutingService.getTiers.mockResolvedValue(tiers);

      const result = await controller.getTiers(mockUser, mockAgentName);

      expect(mockRoutingService.getTiers).toHaveBeenCalledWith(TEST_AGENT_ID, 'user-1');
      expect(result).toBe(tiers);
    });
  });

  /* ── setOverride ── */

  describe('setOverride', () => {
    it('should call service with tier and model', async () => {
      const updated = { tier: 'complex', override_model: 'claude-opus-4-6' };
      mockRoutingService.setOverride.mockResolvedValue(updated);

      const result = await controller.setOverride(mockUser, 'test-agent', 'complex', {
        model: 'claude-opus-4-6',
      });

      expect(mockRoutingService.setOverride).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'user-1',
        'complex',
        'claude-opus-4-6',
        undefined,
      );
      expect(result).toBe(updated);
    });
  });

  /* ── clearOverride ── */

  describe('clearOverride', () => {
    it('should return ok after clearing', async () => {
      const result = await controller.clearOverride(mockUser, 'test-agent', 'simple');

      expect(mockRoutingService.clearOverride).toHaveBeenCalledWith(TEST_AGENT_ID, 'simple');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── resetAllOverrides ── */

  describe('resetAllOverrides', () => {
    it('should return ok after resetting', async () => {
      const result = await controller.resetAllOverrides(mockUser, mockAgentName);

      expect(mockRoutingService.resetAllOverrides).toHaveBeenCalledWith(TEST_AGENT_ID);
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

      await controller.upsertProvider(mockUser, mockAgentName, { provider: 'ollama' });

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
        display_name: '',
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

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].model_name).toBe('gpt-4o');
    });

    it('should expand provider aliases (gemini ↔ google)', async () => {
      mockRoutingService.getProviders.mockResolvedValue([{ provider: 'gemini', is_active: true }]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gemini-2.5-pro', provider: 'Google' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].model_name).toBe('gemini-2.5-pro');
    });

    it('should match models by name prefix when provider field differs (OpenRouter)', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'anthropic', is_active: true },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'anthropic/claude-sonnet-4', provider: 'OpenRouter' }),
        makePricing({ model_name: 'openai/gpt-4o', provider: 'OpenRouter' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].model_name).toBe('anthropic/claude-sonnet-4');
    });

    it('should include OpenRouter-hosted vendor-prefixed models when OpenRouter is active', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openrouter', is_active: true },
      ]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'qwen/qwen3-235b-a22b', provider: 'OpenRouter' }),
        makePricing({ model_name: 'qwen3-235b-a22b', provider: 'Alibaba' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result.map((m) => m.model_name)).toContain('qwen/qwen3-235b-a22b');
      expect(result.map((m) => m.model_name)).not.toContain('qwen3-235b-a22b');
    });

    it('should return empty array when no active providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([{ provider: 'openai', is_active: false }]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);
      expect(result).toEqual([]);
    });

    it('should return only whitelisted fields', async () => {
      mockRoutingService.getProviders.mockResolvedValue([{ provider: 'openai', is_active: true }]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(Object.keys(result[0]).sort()).toEqual([
        'capability_code',
        'capability_reasoning',
        'context_window',
        'display_name',
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

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.model_name).sort()).toEqual(['gpt-4o', 'grok-3']);
    });

    it('should include display_name and provider_display_name for custom provider models', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-uuid', is_active: true },
      ]);
      mockCustomProviderService.list.mockResolvedValue([{ id: 'cp-uuid', name: 'Groq' }]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({
          model_name: 'custom:cp-uuid/llama-3.1-70b',
          provider: 'custom:cp-uuid',
        }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('llama-3.1-70b');
      expect(result[0].provider_display_name).toBe('Groq');
    });

    it('should fall back to provider key when custom provider name not in map', async () => {
      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-orphan', is_active: true },
      ]);
      mockCustomProviderService.list.mockResolvedValue([]); // no custom providers found
      mockPricingCache.getAll.mockReturnValue([
        makePricing({
          model_name: 'custom:cp-orphan/model-x',
          provider: 'custom:cp-orphan',
        }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('model-x');
      expect(result[0].provider_display_name).toBe('custom:cp-orphan');
    });

    it('should include display_name for non-custom providers', async () => {
      mockRoutingService.getProviders.mockResolvedValue([{ provider: 'openai', is_active: true }]);
      mockPricingCache.getAll.mockReturnValue([
        makePricing({ model_name: 'gpt-4o', provider: 'OpenAI', display_name: 'GPT-4o' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('GPT-4o');
      expect(result[0]).not.toHaveProperty('provider_display_name');
    });
  });

  /* ── fallback endpoints ── */

  describe('fallback endpoints', () => {
    it('should delegate getFallbacks to service', async () => {
      mockRoutingService.getFallbacks.mockResolvedValue(['model-a']);
      const result = await controller.getFallbacks(mockUser, 'test-agent', 'standard');
      expect(mockRoutingService.getFallbacks).toHaveBeenCalledWith(TEST_AGENT_ID, 'standard');
      expect(result).toEqual(['model-a']);
    });

    it('should delegate setFallbacks to service', async () => {
      mockRoutingService.setFallbacks.mockResolvedValue(['model-a', 'model-b']);
      const result = await controller.setFallbacks(mockUser, 'test-agent', 'standard', {
        models: ['model-a', 'model-b'],
      });
      expect(mockRoutingService.setFallbacks).toHaveBeenCalledWith(TEST_AGENT_ID, 'standard', [
        'model-a',
        'model-b',
      ]);
      expect(result).toEqual(['model-a', 'model-b']);
    });

    it('should delegate clearFallbacks to service', async () => {
      const result = await controller.clearFallbacks(mockUser, 'test-agent', 'standard');
      expect(mockRoutingService.clearFallbacks).toHaveBeenCalledWith(TEST_AGENT_ID, 'standard');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── resolveAgent (tested through public endpoints) ── */

  describe('resolveAgent', () => {
    it('should throw NotFoundException when tenant is not found', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));

      await expect(controller.getStatus(mockUser, mockAgentName)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockResolveAgent.resolve).toHaveBeenCalledWith('user-1', 'test-agent');
    });

    it('should throw NotFoundException when agent is not found', async () => {
      mockResolveAgent.resolve.mockRejectedValue(
        new NotFoundException('Agent "nonexistent" not found'),
      );

      await expect(
        controller.getProviders(mockUser, { agentName: 'nonexistent' } as never),
      ).rejects.toThrow(NotFoundException);
      expect(mockResolveAgent.resolve).toHaveBeenCalledWith('user-1', 'nonexistent');
    });

    it('should resolve agent and pass its id to service methods', async () => {
      mockResolveAgent.resolve.mockResolvedValue({ id: 'agent-xyz', name: 'my-agent' });
      mockRoutingService.getProviders.mockResolvedValue([]);

      await controller.getStatus(mockUser, { agentName: 'my-agent' } as never);

      expect(mockResolveAgent.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
      expect(mockRoutingService.getProviders).toHaveBeenCalledWith('agent-xyz');
    });

    it('should propagate NotFoundException through upsertProvider', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));

      await expect(
        controller.upsertProvider(mockUser, mockAgentName, {
          provider: 'openai',
          apiKey: 'sk-test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException through removeProvider', async () => {
      mockResolveAgent.resolve.mockRejectedValue(
        new NotFoundException('Agent "missing-agent" not found'),
      );

      await expect(
        controller.removeProvider(
          mockUser,
          { agentName: 'missing-agent', provider: 'openai' } as never,
          {} as never,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException through getTiers', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));

      await expect(controller.getTiers(mockUser, mockAgentName)).rejects.toThrow(NotFoundException);
    });
  });
});
