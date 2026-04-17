import { ModelController } from './model.controller';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { CustomProviderService } from './custom-provider/custom-provider.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';
import { PricingSyncService } from '../database/pricing-sync.service';
import { DiscoveredModel } from '../model-discovery/model-fetcher';
import { Agent } from '../entities/agent.entity';

const mockUser = { id: 'user-1' } as never;
const mockAgentName = { agentName: 'test-agent' } as never;
const TEST_AGENT_ID = 'agent-001';

function makeDiscovered(overrides: Partial<DiscoveredModel> = {}): DiscoveredModel {
  return {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerToken: 0.0000025,
    outputPricePerToken: 0.00001,
    capabilityReasoning: false,
    capabilityCode: true,
    qualityScore: 3,
    ...overrides,
  };
}

describe('ModelController', () => {
  let controller: ModelController;
  let mockProviderService: Record<string, jest.Mock>;
  let mockDiscoveryService: Record<string, jest.Mock>;
  let mockOllamaSync: Record<string, jest.Mock>;
  let mockResolveAgent: Record<string, jest.Mock>;
  let mockCustomProviderService: Record<string, jest.Mock>;
  let mockPricingSync: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderService = {
      recalculateTiers: jest.fn().mockResolvedValue(undefined),
    };
    mockDiscoveryService = {
      getModelsForAgent: jest.fn().mockResolvedValue([]),
      discoverAllForAgent: jest.fn().mockResolvedValue(undefined),
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
    mockPricingSync = {
      getAll: jest.fn().mockReturnValue(new Map([['gpt-4o', {}]])),
      getLastFetchedAt: jest.fn().mockReturnValue(new Date('2026-04-13T00:00:00Z')),
      refreshCache: jest.fn().mockResolvedValue(42),
    };

    controller = new ModelController(
      mockProviderService as unknown as ProviderService,
      mockDiscoveryService as unknown as ModelDiscoveryService,
      mockOllamaSync as unknown as OllamaSyncService,
      mockResolveAgent as unknown as ResolveAgentService,
      mockCustomProviderService as unknown as CustomProviderService,
      mockPricingSync as unknown as PricingSyncService,
    );
  });

  /* ── pricingHealth ── */

  describe('pricingHealth', () => {
    it('returns cache size and last fetch timestamp', () => {
      mockPricingSync.getAll.mockReturnValue(
        new Map([
          ['a', {}],
          ['b', {}],
        ]),
      );
      mockPricingSync.getLastFetchedAt.mockReturnValue(new Date('2026-04-12T10:00:00Z'));

      const result = controller.pricingHealth();

      expect(result).toEqual({
        model_count: 2,
        last_fetched_at: '2026-04-12T10:00:00.000Z',
      });
    });

    it('returns null last_fetched_at when cache was never populated', () => {
      mockPricingSync.getAll.mockReturnValue(new Map());
      mockPricingSync.getLastFetchedAt.mockReturnValue(null);

      const result = controller.pricingHealth();

      expect(result).toEqual({ model_count: 0, last_fetched_at: null });
    });
  });

  /* ── refreshPricing ── */

  describe('refreshPricing', () => {
    it('triggers a cache refresh and reports the new count', async () => {
      mockPricingSync.refreshCache.mockResolvedValue(150);
      mockPricingSync.getLastFetchedAt.mockReturnValue(new Date('2026-04-13T12:00:00Z'));

      const result = await controller.refreshPricing();

      expect(mockPricingSync.refreshCache).toHaveBeenCalled();
      expect(result).toEqual({
        ok: true,
        model_count: 150,
        last_fetched_at: '2026-04-13T12:00:00.000Z',
      });
    });

    it('returns ok=false when refresh yields zero models', async () => {
      mockPricingSync.refreshCache.mockResolvedValue(0);
      mockPricingSync.getLastFetchedAt.mockReturnValue(null);

      const result = await controller.refreshPricing();

      expect(result).toEqual({ ok: false, model_count: 0, last_fetched_at: null });
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

  /* ── refreshModels ── */

  describe('refreshModels', () => {
    it('should call discoverAllForAgent and return ok', async () => {
      const result = await controller.refreshModels(mockUser, mockAgentName);

      expect(mockResolveAgent.resolve).toHaveBeenCalledWith('user-1', 'test-agent');
      expect(mockDiscoveryService.discoverAllForAgent).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── getAvailableModels ── */

  describe('getAvailableModels', () => {
    it('should return models from discovery service', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({ id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(mockDiscoveryService.getModelsForAgent).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].model_name).toBe('gpt-4o');
      expect(result[0].provider).toBe('openai');
    });

    it('should return empty array when no models discovered', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);
      expect(result).toEqual([]);
    });

    it('should map DiscoveredModel fields to response format', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({
          id: 'gpt-4o',
          provider: 'openai',
          displayName: 'GPT-4o',
          inputPricePerToken: 0.0000025,
          outputPricePerToken: 0.00001,
          contextWindow: 128000,
          capabilityReasoning: false,
          capabilityCode: true,
          qualityScore: 3,
        }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result[0]).toEqual({
        model_name: 'gpt-4o',
        provider: 'openai',
        auth_type: 'api_key',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
        context_window: 128000,
        capability_reasoning: false,
        capability_code: true,
        quality_score: 3,
        display_name: 'GPT-4o',
      });
    });

    it('should return only whitelisted fields for non-custom models', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({ id: 'gpt-4o', provider: 'openai' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(Object.keys(result[0]).sort()).toEqual([
        'auth_type',
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

    it('should use null for display_name when displayName is empty', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({ id: 'some-model', provider: 'openai', displayName: '' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result[0].display_name).toBeNull();
    });

    it('should include models from multiple providers', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({ id: 'gpt-4o', provider: 'openai' }),
        makeDiscovered({ id: 'grok-3', provider: 'xai' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.model_name).sort()).toEqual(['gpt-4o', 'grok-3']);
    });

    it('should include display_name and provider_display_name for custom provider models', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({
          id: 'custom:cp-uuid/llama-3.1-70b',
          provider: 'custom:cp-uuid',
          displayName: 'llama-3.1-70b',
        }),
      ]);
      mockCustomProviderService.list.mockResolvedValue([{ id: 'cp-uuid', name: 'Groq' }]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('llama-3.1-70b');
      expect(result[0].provider_display_name).toBe('Groq');
    });

    it('should fall back to provider key when custom provider name not in map', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({
          id: 'custom:cp-orphan/model-x',
          provider: 'custom:cp-orphan',
          displayName: 'model-x',
        }),
      ]);
      mockCustomProviderService.list.mockResolvedValue([]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe('model-x');
      expect(result[0].provider_display_name).toBe('custom:cp-orphan');
    });

    it('should not include provider_display_name for non-custom providers', async () => {
      mockDiscoveryService.getModelsForAgent.mockResolvedValue([
        makeDiscovered({ id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o' }),
      ]);

      const result = await controller.getAvailableModels(mockUser, mockAgentName);

      expect(result[0].display_name).toBe('GPT-4o');
      expect(result[0]).not.toHaveProperty('provider_display_name');
    });
  });
});
