import { NotFoundException } from '@nestjs/common';
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
const mockAgentName = { agentName: 'test-agent' } as never;
const TEST_AGENT_ID = 'agent-001';

describe('RoutingController', () => {
  let controller: RoutingController;
  let mockRoutingService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;
  let mockOllamaSync: Record<string, jest.Mock>;
  let mockAgentRepo: Record<string, jest.Mock>;
  let mockTenantRepo: Record<string, jest.Mock>;

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
    mockTenantRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-001', name: 'user-1' }),
    };
    mockAgentRepo = {
      findOne: jest.fn().mockResolvedValue({ id: TEST_AGENT_ID, name: 'test-agent' }),
    };

    controller = new RoutingController(
      mockRoutingService as unknown as RoutingService,
      mockPricingCache as unknown as ModelPricingCacheService,
      mockOllamaSync as unknown as OllamaSyncService,
      mockAgentRepo as never,
      mockTenantRepo as never,
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
        },
      ]);
      mockRoutingService.getKeyPrefix.mockReturnValue('sk-proj-');

      const result = await controller.getProviders(mockUser, mockAgentName);

      expect(mockRoutingService.getProviders).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual([
        {
          id: 'p1',
          provider: 'openai',
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
          agent_id: 'a1',
        },
      ]);
      mockRoutingService.getKeyPrefix.mockReturnValue('sk-proj-');

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
      );
      expect(result).toEqual({ id: 'p1', provider: 'anthropic', is_active: true });
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
      );
      expect(result).toEqual({ id: 'p1', provider: 'openai', is_active: true });
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

      expect(result).toEqual({ id: 'p1', provider: 'openai', is_active: true });
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

      const result = await controller.removeProvider(mockUser, 'test-agent', 'openai');

      expect(mockRoutingService.removeProvider).toHaveBeenCalledWith(TEST_AGENT_ID, 'openai');
      expect(result).toEqual({ ok: true, notifications: 3 });
    });

    it('should return zero notifications when none cleared', async () => {
      mockRoutingService.removeProvider.mockResolvedValue({ notifications: 0 });

      const result = await controller.removeProvider(mockUser, 'test-agent', 'deepseek');
      expect(result).toEqual({ ok: true, notifications: 0 });
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
  });

  /* ── resolveAgent (tested through public endpoints) ── */

  describe('resolveAgent', () => {
    it('should throw NotFoundException when tenant is not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(controller.getStatus(mockUser, mockAgentName)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'user-1' },
      });
      expect(mockAgentRepo.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when agent is not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue({ id: 'tenant-001', name: 'user-1' });
      mockAgentRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.getProviders(mockUser, { agentName: 'nonexistent' } as never),
      ).rejects.toThrow(NotFoundException);
      expect(mockAgentRepo.findOne).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-001', name: 'nonexistent' },
      });
    });

    it('should resolve agent and pass its id to service methods', async () => {
      mockTenantRepo.findOne.mockResolvedValue({ id: 'tenant-002', name: 'user-1' });
      mockAgentRepo.findOne.mockResolvedValue({ id: 'agent-xyz', name: 'my-agent' });
      mockRoutingService.getProviders.mockResolvedValue([]);

      await controller.getStatus(mockUser, { agentName: 'my-agent' } as never);

      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'user-1' },
      });
      expect(mockAgentRepo.findOne).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-002', name: 'my-agent' },
      });
      expect(mockRoutingService.getProviders).toHaveBeenCalledWith('agent-xyz');
    });

    it('should propagate NotFoundException through upsertProvider', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.upsertProvider(mockUser, mockAgentName, {
          provider: 'openai',
          apiKey: 'sk-test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException through removeProvider', async () => {
      mockTenantRepo.findOne.mockResolvedValue({ id: 'tenant-001', name: 'user-1' });
      mockAgentRepo.findOne.mockResolvedValue(null);

      await expect(controller.removeProvider(mockUser, 'missing-agent', 'openai')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate NotFoundException through getTiers', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(controller.getTiers(mockUser, mockAgentName)).rejects.toThrow(NotFoundException);
    });
  });
});
