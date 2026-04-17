import { NotFoundException } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { TierService } from './routing-core/tier.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { PricingSyncService } from '../database/pricing-sync.service';
import { Agent } from '../entities/agent.entity';

const mockUser = { id: 'user-1' } as never;
const mockAgentName = { agentName: 'test-agent' } as never;
const TEST_AGENT_ID = 'agent-001';

describe('ProviderController', () => {
  let controller: ProviderController;
  let mockProviderService: Record<string, jest.Mock>;
  let mockDiscoveryService: Record<string, jest.Mock>;
  let mockOllamaSync: Record<string, jest.Mock>;
  let mockResolveAgent: Record<string, jest.Mock>;
  let mockTierService: Record<string, jest.Mock>;
  let mockPricingSync: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderService = {
      getProviders: jest.fn().mockResolvedValue([]),
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: false }),
      removeProvider: jest.fn().mockResolvedValue({ notifications: 0 }),
      deactivateAllProviders: jest.fn().mockResolvedValue(undefined),
      recalculateTiers: jest.fn().mockResolvedValue(undefined),
    };
    mockDiscoveryService = {
      discoverModels: jest.fn().mockResolvedValue([]),
    };
    mockOllamaSync = {
      sync: jest.fn().mockResolvedValue({ count: 0 }),
    };
    mockResolveAgent = {
      resolve: jest.fn().mockResolvedValue({ id: TEST_AGENT_ID, name: 'test-agent' } as Agent),
    };
    mockTierService = {
      hasRoutableTier: jest.fn().mockResolvedValue(true),
    };
    mockPricingSync = {
      getAll: jest.fn().mockReturnValue(new Map([['model-1', {}]])),
    };

    controller = new ProviderController(
      mockProviderService as unknown as ProviderService,
      mockDiscoveryService as unknown as ModelDiscoveryService,
      mockOllamaSync as unknown as OllamaSyncService,
      mockResolveAgent as unknown as ResolveAgentService,
      mockTierService as unknown as TierService,
      mockPricingSync as unknown as PricingSyncService,
    );
  });

  /* ── getStatus ── */

  describe('getStatus', () => {
    it('returns enabled true when a provider is active and a tier is routable', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true },
      ]);
      mockTierService.hasRoutableTier.mockResolvedValue(true);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: true, reason: null });
    });

    it('returns no_provider when no providers are active', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: false },
      ]);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: false, reason: 'no_provider' });
      expect(mockTierService.hasRoutableTier).not.toHaveBeenCalled();
    });

    it('returns no_provider when no providers exist', async () => {
      mockProviderService.getProviders.mockResolvedValue([]);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: false, reason: 'no_provider' });
    });

    it('considers mixed active/inactive providers as having an active one', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: false },
        { id: 'p2', provider: 'anthropic', is_active: true },
      ]);
      mockTierService.hasRoutableTier.mockResolvedValue(true);

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: true, reason: null });
    });

    it('returns no_routable_models when provider is active but no tier resolves', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true },
      ]);
      mockTierService.hasRoutableTier.mockResolvedValue(false);
      mockPricingSync.getAll.mockReturnValue(new Map([['gpt-4', {}]]));

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: false, reason: 'no_routable_models' });
    });

    it('returns pricing_cache_empty when tiers are empty and pricing cache is empty', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { id: 'p1', provider: 'openai', is_active: true },
      ]);
      mockTierService.hasRoutableTier.mockResolvedValue(false);
      mockPricingSync.getAll.mockReturnValue(new Map());

      const result = await controller.getStatus(mockUser, mockAgentName);
      expect(result).toEqual({ enabled: false, reason: 'pricing_cache_empty' });
    });
  });

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return mapped provider list', async () => {
      mockProviderService.getProviders.mockResolvedValue([
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

      expect(mockProviderService.getProviders).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual([
        {
          id: 'p1',
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
          has_api_key: true,
          key_prefix: 'sk-proj-',
          region: null,
          connected_at: '2025-01-01',
        },
      ]);
    });

    it('should strip internal fields from response', async () => {
      mockProviderService.getProviders.mockResolvedValue([
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

    it('should return null key_prefix when provider has no key_prefix', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        {
          id: 'p2',
          provider: 'anthropic',
          is_active: true,
          connected_at: '2025-02-01',
          api_key_encrypted: null,
        },
      ]);

      const result = await controller.getProviders(mockUser, mockAgentName);
      expect(result[0].key_prefix).toBeNull();
      expect(result[0].has_api_key).toBe(false);
    });

    it('should return empty array when no providers', async () => {
      const result = await controller.getProviders(mockUser, mockAgentName);
      expect(result).toEqual([]);
    });
  });

  /* ── upsertProvider ── */

  describe('upsertProvider', () => {
    it('should call service and return mapped result (with apiKey)', async () => {
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'anthropic', is_active: true, api_key_encrypted: 'enc' },
        isNew: true,
      });

      const result = await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'user-1',
        'anthropic',
        'sk-ant-test',
        undefined,
        undefined,
      );
      expect(result).toEqual({
        id: 'p1',
        provider: 'anthropic',
        auth_type: 'api_key',
        is_active: true,
        region: null,
      });
    });

    it('should call service without apiKey', async () => {
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'openai', is_active: true, api_key_encrypted: null },
        isNew: false,
      });

      const result = await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
      });

      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'user-1',
        'openai',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual({
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        region: null,
      });
    });

    it('should trigger discoveryService.discoverModels in background', async () => {
      const providerResult = { id: 'p1', provider: 'openai', is_active: true };
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: providerResult,
        isNew: false,
      });

      await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(mockDiscoveryService.discoverModels).toHaveBeenCalledWith(providerResult);
    });

    it('should call recalculateTiers after discovery in upsertProvider', async () => {
      const providerResult = { id: 'p1', provider: 'openai', is_active: true };
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: providerResult,
        isNew: true,
      });

      await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(mockProviderService.recalculateTiers).toHaveBeenCalledWith(TEST_AGENT_ID);
    });

    it('should swallow discovery errors silently', async () => {
      const providerResult = { id: 'p1', provider: 'openai', is_active: true };
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: providerResult,
        isNew: false,
      });
      mockDiscoveryService.discoverModels.mockRejectedValue(new Error('fetch failed'));

      const result = await controller.upsertProvider(mockUser, mockAgentName, {
        provider: 'openai',
        apiKey: 'sk-test',
      });

      expect(result).toEqual({
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        region: null,
      });
    });

    it('should not expose api_key_encrypted in response', async () => {
      mockProviderService.upsertProvider.mockResolvedValue({
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
        region: null,
      });
      expect(result).not.toHaveProperty('api_key_encrypted');
      expect(result).not.toHaveProperty('agent_id');
    });

    it('should sync ollama models before connecting', async () => {
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: { id: 'p1', provider: 'ollama', is_active: true },
        isNew: true,
      });

      await controller.upsertProvider(mockUser, mockAgentName, { provider: 'ollama' });

      expect(mockOllamaSync.sync).toHaveBeenCalled();
      expect(mockProviderService.upsertProvider).toHaveBeenCalled();
    });
  });

  /* ── deactivateAllProviders ── */

  describe('deactivateAllProviders', () => {
    it('should return ok after deactivating all', async () => {
      const result = await controller.deactivateAllProviders(mockUser, mockAgentName);

      expect(mockProviderService.deactivateAllProviders).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── removeProvider ── */

  describe('removeProvider', () => {
    it('should return ok with notification count', async () => {
      mockProviderService.removeProvider.mockResolvedValue({ notifications: 3 });

      const result = await controller.removeProvider(
        mockUser,
        { agentName: 'test-agent', provider: 'openai' } as never,
        {} as never,
      );

      expect(mockProviderService.removeProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'openai',
        undefined,
      );
      expect(result).toEqual({ ok: true, notifications: 3 });
    });

    it('should return zero notifications when none cleared', async () => {
      mockProviderService.removeProvider.mockResolvedValue({ notifications: 0 });

      const result = await controller.removeProvider(
        mockUser,
        { agentName: 'test-agent', provider: 'deepseek' } as never,
        {} as never,
      );
      expect(result).toEqual({ ok: true, notifications: 0 });
    });

    it('should pass authType to service when provided', async () => {
      mockProviderService.removeProvider.mockResolvedValue({ notifications: [] });

      await controller.removeProvider(
        mockUser,
        { agentName: 'test-agent', provider: 'anthropic' } as never,
        { authType: 'subscription' } as never,
      );

      expect(mockProviderService.removeProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'anthropic',
        'subscription',
      );
    });
  });

  /* ── resolveAgent ── */

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
      mockProviderService.getProviders.mockResolvedValue([]);

      await controller.getStatus(mockUser, { agentName: 'my-agent' } as never);

      expect(mockResolveAgent.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
      expect(mockProviderService.getProviders).toHaveBeenCalledWith('agent-xyz');
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
  });
});
