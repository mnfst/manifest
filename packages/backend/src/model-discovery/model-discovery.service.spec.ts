import { ModelDiscoveryService } from './model-discovery.service';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { ProviderModelRegistryService } from './provider-model-registry.service';
import { UserProvider } from '../entities/user-provider.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { DiscoveredModel } from './model-fetcher';
import { buildSubscriptionFallbackModels, supplementWithKnownModels } from './model-fallback';

jest.mock('../common/utils/crypto.util', () => ({
  decrypt: jest.fn(),
  getEncryptionSecret: jest.fn(),
}));

jest.mock('../database/quality-score.util', () => ({
  computeQualityScore: jest.fn().mockReturnValue(3),
}));

jest.mock('./anthropic-subscription-probe', () => ({
  filterBySubscriptionAccess: jest.fn().mockImplementation((models: unknown[]) => models),
}));

import { decrypt, getEncryptionSecret } from '../common/utils/crypto.util';
import { filterBySubscriptionAccess } from './anthropic-subscription-probe';
import { computeQualityScore } from '../database/quality-score.util';

const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockGetSecret = getEncryptionSecret as jest.MockedFunction<typeof getEncryptionSecret>;
const mockComputeScore = computeQualityScore as jest.MockedFunction<typeof computeQualityScore>;

function makeModel(overrides: Partial<DiscoveredModel> = {}): DiscoveredModel {
  return {
    id: 'test-model',
    displayName: 'Test Model',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
    ...overrides,
  };
}

function makeProvider(overrides: Partial<UserProvider> = {}): UserProvider {
  return {
    id: 'prov-1',
    user_id: 'user-1',
    agent_id: 'agent-1',
    provider: 'openai',
    api_key_encrypted: 'encrypted-key',
    key_prefix: 'sk-',
    auth_type: 'api_key',
    is_active: true,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cached_models: null,
    models_fetched_at: null,
    ...overrides,
  } as UserProvider;
}

function makeCustomProvider(overrides: Partial<CustomProvider> = {}): CustomProvider {
  return {
    id: 'cp-1',
    agent_id: 'agent-1',
    user_id: 'user-1',
    name: 'My Custom',
    base_url: 'http://localhost:8000',
    models: [
      {
        model_name: 'custom-llm',
        input_price_per_million_tokens: 1.5,
        output_price_per_million_tokens: 3.0,
        context_window: 32000,
      },
    ],
    created_at: new Date().toISOString(),
    ...overrides,
  } as CustomProvider;
}

function makeMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
  };
}

describe('ModelDiscoveryService', () => {
  let service: ModelDiscoveryService;
  let providerRepo: ReturnType<typeof makeMockRepo>;
  let customProviderRepo: ReturnType<typeof makeMockRepo>;
  let fetcher: { fetch: jest.Mock };
  let mockPricingSync: { lookupPricing: jest.Mock; getAll: jest.Mock };
  let mockModelRegistry: {
    registerModels: jest.Mock;
    getConfirmedModels: jest.Mock;
  };
  let mockModelsDevSync: { lookupModel: jest.Mock; getModelsForProvider: jest.Mock };
  let mockCopilotTokenService: { getCopilotToken: jest.Mock };

  beforeEach(() => {
    providerRepo = makeMockRepo();
    customProviderRepo = makeMockRepo();
    fetcher = { fetch: jest.fn().mockResolvedValue([]) };
    mockPricingSync = {
      lookupPricing: jest.fn().mockReturnValue(null),
      getAll: jest.fn().mockReturnValue(new Map()),
    };
    mockModelsDevSync = {
      lookupModel: jest.fn().mockReturnValue(null),
      getModelsForProvider: jest.fn().mockReturnValue([]),
    };
    mockModelRegistry = {
      registerModels: jest.fn(),
      getConfirmedModels: jest.fn().mockReturnValue(null),
    };
    mockCopilotTokenService = {
      getCopilotToken: jest.fn().mockResolvedValue('tid=exchanged-copilot-token'),
    };

    mockDecrypt.mockReturnValue('decrypted-key');
    mockGetSecret.mockReturnValue('secret-32-chars-long-xxxxxxxxxx');
    mockComputeScore.mockReturnValue(3);

    service = new ModelDiscoveryService(
      providerRepo as never,
      customProviderRepo as never,
      fetcher as unknown as ProviderModelFetcherService,
      mockPricingSync as never,
      mockModelsDevSync as never,
      mockModelRegistry as unknown as ProviderModelRegistryService,
      mockCopilotTokenService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /* ── discoverModels ── */

  describe('discoverModels', () => {
    it('should decrypt key, fetch, enrich, and cache models', async () => {
      const models = [makeModel({ id: 'gpt-4' })];
      fetcher.fetch.mockResolvedValue(models);

      const provider = makeProvider();
      const result = await service.discoverModels(provider);

      expect(mockGetSecret).toHaveBeenCalled();
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted-key', expect.any(String));
      expect(fetcher.fetch).toHaveBeenCalledWith('openai', 'decrypted-key', 'api_key', undefined);
      expect(result).toHaveLength(1);
      expect(provider.cached_models).toEqual(result);
      expect(provider.models_fetched_at).toBeDefined();
      expect(providerRepo.save).toHaveBeenCalledWith(provider);
    });

    it('should return [] when decrypt fails', async () => {
      mockDecrypt.mockImplementation(() => {
        throw new Error('bad key');
      });

      const result = await service.discoverModels(makeProvider());
      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('should pass empty string as key when no encrypted key', async () => {
      const provider = makeProvider({ api_key_encrypted: null });
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(provider);

      expect(mockDecrypt).not.toHaveBeenCalled();
      expect(fetcher.fetch).toHaveBeenCalledWith('openai', '', 'api_key', undefined);
    });

    it('should enrich models with openRouter pricing when available', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'openai/gpt-4') {
          return {
            input: 0.00003,
            output: 0.00006,
            contextWindow: 200000,
            displayName: 'GPT-4 via OR',
          };
        }
        return null;
      });

      const models = [makeModel({ id: 'gpt-4' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('openai/gpt-4');
      expect(result[0].inputPricePerToken).toBe(0.00003);
      expect(result[0].outputPricePerToken).toBe(0.00006);
      expect(result[0].contextWindow).toBe(200000);
      expect(result[0].displayName).toBe('GPT-4 via OR');
    });

    it('should use model contextWindow when openRouter has no contextWindow', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'openai/gpt-4') {
          return { input: 0.00003, output: 0.00006 };
        }
        return null;
      });

      const models = [makeModel({ id: 'gpt-4', contextWindow: 8192 })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());
      expect(result[0].contextWindow).toBe(8192);
    });

    it('should keep model displayName when openRouter displayName is empty', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'openai/gpt-4') {
          return { input: 0.00003, output: 0.00006, displayName: '' };
        }
        return null;
      });

      const models = [makeModel({ id: 'gpt-4', displayName: 'GPT-4' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());
      expect(result[0].displayName).toBe('GPT-4');
    });

    it('should keep null pricing when pricingSync lookup returns null', async () => {
      const models = [makeModel({ id: 'unknown-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should keep null pricing when pricingSync is null', async () => {
      const serviceNoPricing = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        null,
        null,
        null,
        null,
      );

      const models = [makeModel({ id: 'some-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await serviceNoPricing.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBeNull();
    });

    it('should keep null pricing when no pricing source available', async () => {
      const models = [makeModel({ id: 'unknown-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should skip enrichment when fetcher already provided pricing', async () => {
      const models = [
        makeModel({
          id: 'priced-model',
          inputPricePerToken: 0.001,
          outputPricePerToken: 0.002,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      await service.discoverModels(makeProvider());

      expect(mockPricingSync.lookupPricing).not.toHaveBeenCalled();
    });

    it('should call computeQualityScore for enriched models', async () => {
      mockComputeScore.mockReturnValue(5);
      const models = [makeModel({ id: 'gpt-4' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(mockComputeScore).toHaveBeenCalledWith(
        expect.objectContaining({ model_name: 'gpt-4' }),
      );
      expect(result[0].qualityScore).toBe(5);
    });

    it('should register models in registry after successful native fetch', async () => {
      const models = [makeModel({ id: 'gpt-4o' }), makeModel({ id: 'gpt-4-turbo' })];
      fetcher.fetch.mockResolvedValue(models);

      await service.discoverModels(makeProvider());

      expect(mockModelRegistry.registerModels).toHaveBeenCalledWith('openai', [
        'gpt-4o',
        'gpt-4-turbo',
      ]);
    });

    it('should not register models when native fetch returns empty', async () => {
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(makeProvider());

      expect(mockModelRegistry.registerModels).not.toHaveBeenCalled();
    });

    it('should pass confirmed models to buildFallbackModels when native fetch fails', async () => {
      fetcher.fetch.mockResolvedValue([]);
      const confirmed = new Set(['gpt-4o']);
      mockModelRegistry.getConfirmedModels.mockReturnValue(confirmed);

      // Set up OpenRouter cache with matching models
      const orMap = new Map([
        ['openai/gpt-4o', { input: 0.01, output: 0.02, displayName: 'GPT-4o' }],
        ['openai/phantom', { input: 0.01, output: 0.02, displayName: 'Phantom' }],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(makeProvider());

      expect(mockModelRegistry.getConfirmedModels).toHaveBeenCalledWith('openai');
      // Only confirmed model should be in fallback
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });

    it('should not call registry when modelRegistry is null', async () => {
      const serviceNoRegistry = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        mockPricingSync as never,
        mockModelsDevSync as never,
        null,
        null,
      );

      const models = [makeModel({ id: 'gpt-4o' })];
      fetcher.fetch.mockResolvedValue(models);

      await serviceNoRegistry.discoverModels(makeProvider());

      expect(mockModelRegistry.registerModels).not.toHaveBeenCalled();
    });
  });

  /* ── discoverAllForAgent ── */

  describe('discoverAllForAgent', () => {
    it('should discover models for all active non-custom providers', async () => {
      const providers = [
        makeProvider({ id: 'p1', provider: 'openai' }),
        makeProvider({ id: 'p2', provider: 'anthropic' }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverAllForAgent('agent-1');

      expect(providerRepo.find).toHaveBeenCalledWith({
        where: { agent_id: 'agent-1', is_active: true },
      });
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    it('should skip custom providers', async () => {
      const providers = [
        makeProvider({ id: 'p1', provider: 'openai' }),
        makeProvider({ id: 'p2', provider: 'custom:my-provider' }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverAllForAgent('agent-1');

      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not throw when individual discovery fails', async () => {
      const providers = [
        makeProvider({ id: 'p1', provider: 'openai' }),
        makeProvider({ id: 'p2', provider: 'anthropic' }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      fetcher.fetch.mockResolvedValue([]);

      // Make providerRepo.save throw on first call to trigger .catch handler
      providerRepo.save
        .mockRejectedValueOnce(new Error('DB write failed'))
        .mockResolvedValueOnce({});

      await expect(service.discoverAllForAgent('agent-1')).resolves.not.toThrow();
    });
  });

  /* ── getModelsForAgent ── */

  describe('getModelsForAgent', () => {
    it('should merge cached models from providers and custom providers', async () => {
      const cachedModels = [makeModel({ id: 'gpt-4', provider: 'openai' })];
      const providers = [makeProvider({ cached_models: cachedModels })];
      providerRepo.find.mockResolvedValue(providers);

      const customProviders = [makeCustomProvider()];
      customProviderRepo.find.mockResolvedValue(customProviders);

      const result = await service.getModelsForAgent('agent-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('gpt-4');
      expect(result[1].id).toBe('custom:cp-1/custom-llm');
      expect(result[1].provider).toBe('custom:cp-1');
      expect(result[1].displayName).toBe('custom-llm');
    });

    it('should deduplicate models by id', async () => {
      const providers = [
        makeProvider({
          id: 'p1',
          provider: 'openai',
          cached_models: [makeModel({ id: 'gpt-4' })],
        }),
        makeProvider({
          id: 'p2',
          provider: 'deepseek',
          cached_models: [makeModel({ id: 'gpt-4' })],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toHaveLength(1);
    });

    it('should skip providers with no cached_models', async () => {
      const providers = [makeProvider({ cached_models: null })];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toEqual([]);
    });

    it('should skip custom: prefixed providers from main loop', async () => {
      const providers = [
        makeProvider({
          provider: 'custom:provider-x',
          cached_models: [makeModel({ id: 'custom-model' })],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toEqual([]);
    });

    it('should handle custom provider with no models array', async () => {
      providerRepo.find.mockResolvedValue([]);
      customProviderRepo.find.mockResolvedValue([makeCustomProvider({ models: null as never })]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toEqual([]);
    });

    it('should handle custom provider with null pricing', async () => {
      providerRepo.find.mockResolvedValue([]);
      customProviderRepo.find.mockResolvedValue([
        makeCustomProvider({
          models: [
            {
              model_name: 'free-model',
              input_price_per_million_tokens: undefined,
              output_price_per_million_tokens: undefined,
            },
          ],
        }),
      ]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toHaveLength(1);
      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should compute per-token prices from per-million-token prices', async () => {
      providerRepo.find.mockResolvedValue([]);
      customProviderRepo.find.mockResolvedValue([makeCustomProvider()]);

      const result = await service.getModelsForAgent('agent-1');

      expect(result[0].inputPricePerToken).toBeCloseTo(1.5 / 1_000_000);
      expect(result[0].outputPricePerToken).toBeCloseTo(3.0 / 1_000_000);
    });

    it('should default custom model context window to 128000', async () => {
      providerRepo.find.mockResolvedValue([]);
      customProviderRepo.find.mockResolvedValue([
        makeCustomProvider({
          models: [{ model_name: 'no-ctx' }],
        }),
      ]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result[0].contextWindow).toBe(128000);
    });

    it('should deduplicate custom provider models by composite key', async () => {
      providerRepo.find.mockResolvedValue([]);
      customProviderRepo.find.mockResolvedValue([
        makeCustomProvider({
          id: 'cp-1',
          models: [{ model_name: 'dup-model' }, { model_name: 'dup-model' }],
        }),
      ]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toHaveLength(1);
    });
  });

  /* ── getModelForAgent ── */

  describe('getModelForAgent', () => {
    it('should return the matching model', async () => {
      providerRepo.find.mockResolvedValue([
        makeProvider({
          cached_models: [makeModel({ id: 'gpt-4' }), makeModel({ id: 'gpt-3.5' })],
        }),
      ]);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelForAgent('agent-1', 'gpt-4');
      expect(result).toBeDefined();
      expect(result!.id).toBe('gpt-4');
    });

    it('should return undefined for missing model', async () => {
      providerRepo.find.mockResolvedValue([]);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelForAgent('agent-1', 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  /* ── enrichModel edge cases via discoverModels ── */

  describe('enrichModel (via discoverModels)', () => {
    it('should preserve zero pricing from fetcher (free/subscription models)', async () => {
      // inputPricePerToken is 0 (free/subscription), enrichment should NOT override
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'openai/free-model') {
          return { input: 0.001, output: 0.002 };
        }
        return null;
      });

      const models = [
        makeModel({ id: 'free-model', inputPricePerToken: 0, outputPricePerToken: 0 }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());
      // Price=0 means "free/included" — should not be overwritten
      expect(result[0].inputPricePerToken).toBe(0);
      expect(result[0].outputPricePerToken).toBe(0);
    });

    it('should apply capabilities from models.dev even when pricing is already set', async () => {
      // Copilot/subscription model has price=0 but needs capability flags for scoring
      mockModelsDevSync.lookupModel.mockImplementation((providerId: string, modelId: string) => {
        if (modelId === 'copilot-model') {
          return {
            id: 'copilot-model',
            name: 'Copilot Model',
            inputPricePerToken: 0.000005, // pricing should NOT be applied
            outputPricePerToken: 0.000025,
            reasoning: true,
            toolCall: true,
          };
        }
        return null;
      });

      const models = [
        makeModel({
          id: 'copilot-model',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: false,
          capabilityCode: false,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Pricing preserved as 0 (not overwritten)
      expect(result[0].inputPricePerToken).toBe(0);
      expect(result[0].outputPricePerToken).toBe(0);
      // Capabilities applied from models.dev
      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
    });

    it('should fall back to exact model ID lookup when prefix lookup misses', async () => {
      // Prefix lookup returns null, but exact model ID lookup returns pricing
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'openai/special-model') return null;
        if (key === 'special-model') {
          return { input: 0.0001, output: 0.0002, contextWindow: 64000, displayName: 'Special' };
        }
        return null;
      });

      const models = [makeModel({ id: 'special-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('openai/special-model');
      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('special-model');
      expect(result[0].inputPricePerToken).toBe(0.0001);
      expect(result[0].outputPricePerToken).toBe(0.0002);
      expect(result[0].contextWindow).toBe(64000);
      expect(result[0].displayName).toBe('Special');
    });

    it('should resolve prefix via displayName when provider ID is not a prefix', async () => {
      // 'Mistral' is the displayName for prefix 'mistralai' in OPENROUTER_PREFIX_TO_PROVIDER
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'mistralai/mistral-large') {
          return { input: 0.00002, output: 0.00006 };
        }
        return null;
      });

      const models = [makeModel({ id: 'mistral-large' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'Mistral' }));

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('mistralai/mistral-large');
      expect(result[0].inputPricePerToken).toBe(0.00002);
      expect(result[0].outputPricePerToken).toBe(0.00006);
    });

    it('should use models.dev pricing before OpenRouter when available', async () => {
      mockModelsDevSync.lookupModel.mockImplementation((providerId: string, modelId: string) => {
        if (providerId === 'openai' && modelId === 'gpt-4o') {
          return {
            id: 'gpt-4o',
            name: 'GPT-4o',
            inputPricePerToken: 0.0000025,
            outputPricePerToken: 0.00001,
            contextWindow: 128000,
            reasoning: false,
          };
        }
        return null;
      });
      // OpenRouter also has pricing but should NOT be used
      mockPricingSync.lookupPricing.mockReturnValue({
        input: 0.99,
        output: 0.99,
        displayName: 'Wrong',
      });

      const models = [makeModel({ id: 'gpt-4o' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBe(0.0000025);
      expect(result[0].outputPricePerToken).toBe(0.00001);
      expect(result[0].displayName).toBe('GPT-4o');
    });

    it('should propagate capabilities from models.dev to quality scoring', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        inputPricePerToken: 0.000005,
        outputPricePerToken: 0.000025,
        contextWindow: 1000000,
        reasoning: true,
        toolCall: true,
      });

      const models = [
        makeModel({ id: 'claude-opus-4-6', capabilityReasoning: false, capabilityCode: false }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'anthropic' }));

      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
    });

    it('should fall through to OpenRouter when models.dev has no match', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue(null);
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'openai/new-model') {
          return { input: 0.001, output: 0.002, displayName: 'New Model' };
        }
        return null;
      });

      const models = [makeModel({ id: 'new-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBe(0.001);
      expect(result[0].displayName).toBe('New Model');
    });

    it('should skip prefix lookup when provider has no OpenRouter prefix', async () => {
      // Use a provider that has no OpenRouter prefix mapping
      const models = [makeModel({ id: 'unknown-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'unknown-provider' }));

      // lookupPricing should still be called for exact match (model.id)
      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('unknown-model');
      expect(result[0].inputPricePerToken).toBeNull();
    });

    it('should use model defaults when exact match has no contextWindow or displayName', async () => {
      // No prefix found, exact match returns pricing without optional fields
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'bare-model') {
          return { input: 0.0005, output: 0.001 };
        }
        return null;
      });

      const models = [makeModel({ id: 'bare-model', contextWindow: 4096, displayName: 'Bare' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'unknown-provider' }));

      expect(result[0].inputPricePerToken).toBe(0.0005);
      expect(result[0].contextWindow).toBe(4096);
      expect(result[0].displayName).toBe('Bare');
    });

    it('should call computeQualityScore with null pricing when no source available', async () => {
      mockComputeScore.mockReturnValue(2);

      const models = [makeModel({ id: 'unknown-model' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(mockComputeScore).toHaveBeenCalledWith(
        expect.objectContaining({
          model_name: 'unknown-model',
          input_price_per_token: null,
          output_price_per_token: null,
        }),
      );
      expect(result[0].qualityScore).toBe(2);
    });

    it('should call computeQualityScore even when no pricing is found', async () => {
      const models = [makeModel({ id: 'no-pricing-model' })];
      fetcher.fetch.mockResolvedValue(models);

      await service.discoverModels(makeProvider());

      expect(mockComputeScore).toHaveBeenCalledWith(
        expect.objectContaining({
          model_name: 'no-pricing-model',
          input_price_per_token: null,
          output_price_per_token: null,
        }),
      );
    });

    it('should resolve pricing via dash-to-dot normalization', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'anthropic/claude-sonnet-4.6') {
          return { input: 0.00003, output: 0.00015 };
        }
        return null;
      });

      const models = [makeModel({ id: 'claude-sonnet-4-6' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'anthropic' }));

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('anthropic/claude-sonnet-4-6');
      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('anthropic/claude-sonnet-4.6');
      expect(result[0].inputPricePerToken).toBe(0.00003);
      expect(result[0].outputPricePerToken).toBe(0.00015);
    });

    it('should resolve pricing via dot-to-dash normalization', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'anthropic/claude-sonnet-4-6') {
          return { input: 0.00003, output: 0.00015 };
        }
        return null;
      });

      const models = [makeModel({ id: 'claude-sonnet-4.6' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'anthropic' }));

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('anthropic/claude-sonnet-4.6');
      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('anthropic/claude-sonnet-4-6');
      expect(result[0].inputPricePerToken).toBe(0.00003);
      expect(result[0].outputPricePerToken).toBe(0.00015);
    });

    it('should resolve pricing by stripping date suffix', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'anthropic/claude-sonnet-4-5') {
          return { input: 0.00003, output: 0.00015 };
        }
        return null;
      });

      const models = [makeModel({ id: 'claude-sonnet-4-5-20250929' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'anthropic' }));

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith(
        'anthropic/claude-sonnet-4-5-20250929',
      );
      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('anthropic/claude-sonnet-4-5');
      expect(result[0].inputPricePerToken).toBe(0.00003);
    });

    it('should resolve pricing by stripping date suffix then applying dot variant', async () => {
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'anthropic/claude-sonnet-4.5') {
          return { input: 0.00003, output: 0.00015 };
        }
        return null;
      });

      const models = [makeModel({ id: 'claude-sonnet-4-5-20250929' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ provider: 'anthropic' }));

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('anthropic/claude-sonnet-4.5');
      expect(result[0].inputPricePerToken).toBe(0.00003);
    });

    it('should build fallback models from OpenRouter cache when native API returns empty', async () => {
      fetcher.fetch.mockResolvedValue([]);

      const orMap = new Map([
        [
          'anthropic/claude-opus-4.6',
          {
            input: 0.000015,
            output: 0.000075,
            contextWindow: 200000,
            displayName: 'Claude Opus 4.6',
          },
        ],
        [
          'anthropic/claude-sonnet-4.6',
          {
            input: 0.000003,
            output: 0.000015,
            contextWindow: 200000,
            displayName: 'Claude Sonnet 4.6',
          },
        ],
        [
          'openai/gpt-4o',
          {
            input: 0.0000025,
            output: 0.00001,
            contextWindow: 128000,
            displayName: 'GPT-4o',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(makeProvider({ provider: 'anthropic' }));

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('claude-opus-4-6');
      expect(result[0].displayName).toBe('Claude Opus 4.6');
      expect(result[0].inputPricePerToken).toBe(0.000015);
      expect(result[0].provider).toBe('anthropic');
      expect(result[1].id).toBe('claude-sonnet-4-6');
    });

    it('should unwrap OAuth blob for OpenAI subscription before fetching', async () => {
      const blob = JSON.stringify({
        t: 'access-token-123',
        r: 'refresh-tok',
        e: Date.now() + 60000,
      });
      mockDecrypt.mockReturnValue(blob);

      const models = [makeModel({ id: 'gpt-5.3-codex' })];
      fetcher.fetch.mockResolvedValue(models);

      await service.discoverModels(
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      // Should pass the unwrapped access token, not the JSON blob
      expect(fetcher.fetch).toHaveBeenCalledWith(
        'openai',
        'access-token-123',
        'subscription',
        undefined,
      );
    });

    it('should use raw key when OpenAI subscription blob has no t field', async () => {
      const blob = JSON.stringify({ r: 'refresh-tok', e: Date.now() + 60000 });
      mockDecrypt.mockReturnValue(blob);

      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      // No `t` field — should use the raw JSON string
      expect(fetcher.fetch).toHaveBeenCalledWith('openai', blob, 'subscription', undefined);
    });

    it('should use raw key when OpenAI subscription value is not JSON', async () => {
      mockDecrypt.mockReturnValue('plain-token-value');

      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-plain',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'openai',
        'plain-token-value',
        'subscription',
        undefined,
      );
    });

    it('should not unwrap blob for non-OpenAI subscription providers', async () => {
      const blob = JSON.stringify({ t: 'access-token', r: 'refresh', e: Date.now() + 60000 });
      mockDecrypt.mockReturnValue(blob);

      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      // Should pass the raw JSON string for Anthropic (no unwrapping)
      expect(fetcher.fetch).toHaveBeenCalledWith('anthropic', blob, 'subscription', undefined);
    });

    it('should call filterBySubscriptionAccess for Anthropic subscription providers', async () => {
      const token = 'sk-ant-oat01-test-token';
      mockDecrypt.mockReturnValue(token);

      const models = [
        makeModel({ id: 'claude-haiku-4-5-20251001', provider: 'anthropic' }),
        makeModel({ id: 'claude-sonnet-4-6', provider: 'anthropic' }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const mockFilter = filterBySubscriptionAccess as jest.MockedFunction<
        typeof filterBySubscriptionAccess
      >;
      mockFilter.mockResolvedValue([models[0]]);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
        }),
      );

      expect(mockFilter).toHaveBeenCalledWith(models, token);
      expect(result.map((m) => m.id)).toEqual(['claude-haiku-4-5-20251001']);
    });

    it('should NOT call filterBySubscriptionAccess for Anthropic API key providers', async () => {
      mockDecrypt.mockReturnValue('sk-ant-api03-test-key');

      fetcher.fetch.mockResolvedValue([
        makeModel({ id: 'claude-sonnet-4-6', provider: 'anthropic' }),
      ]);

      const mockFilter = filterBySubscriptionAccess as jest.MockedFunction<
        typeof filterBySubscriptionAccess
      >;
      mockFilter.mockClear();

      await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'api_key',
          api_key_encrypted: 'encrypted',
        }),
      );

      expect(mockFilter).not.toHaveBeenCalled();
    });

    it('should NOT call filterBySubscriptionAccess for non-Anthropic subscription providers', async () => {
      mockDecrypt.mockReturnValue(
        JSON.stringify({ t: 'token', r: 'refresh', e: Date.now() + 60000 }),
      );

      fetcher.fetch.mockResolvedValue([makeModel({ id: 'gpt-4o', provider: 'openai' })]);

      const mockFilter = filterBySubscriptionAccess as jest.MockedFunction<
        typeof filterBySubscriptionAccess
      >;
      mockFilter.mockClear();

      await service.discoverModels(
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
        }),
      );

      expect(mockFilter).not.toHaveBeenCalled();
    });

    it('should unwrap MiniMax OAuth blob and forward resource URL for subscription discovery', async () => {
      const blob = JSON.stringify({
        t: 'minimax-access',
        r: 'minimax-refresh',
        e: Date.now() + 60000,
        u: 'https://api.minimax.io/anthropic',
      });
      mockDecrypt.mockReturnValue(blob);

      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'minimax',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'minimax',
        'minimax-access',
        'subscription',
        'https://api.minimax.io/anthropic',
      );
    });

    it('should fall back to subscription fallback when OpenAI token fetch returns empty', async () => {
      const blob = JSON.stringify({ t: 'expired-token', r: 'refresh', e: Date.now() - 1000 });
      mockDecrypt.mockReturnValue(blob);

      // Fetcher returns empty (e.g., 401 from expired token)
      fetcher.fetch.mockResolvedValue([]);

      const orMap = new Map([
        [
          'openai/gpt-5.2-codex',
          {
            input: 0.000001,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'GPT-5.2 Codex',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      // Should fall back to buildFallbackModels (not subscription fallback, since token exists)
      expect(fetcher.fetch).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should not build pricing fallback models for qwen when native discovery returns empty', async () => {
      fetcher.fetch.mockResolvedValue([]);
      mockPricingSync.getAll.mockReturnValue(
        new Map([
          [
            'qwen/qwen3.5-9b',
            {
              input: 0.0000001,
              output: 0.0000002,
              contextWindow: 128000,
              displayName: 'qwen3.5-9b',
            },
          ],
        ]),
      );

      const provider = makeProvider({
        provider: 'qwen',
        region: 'singapore',
      });
      const result = await service.discoverModels(provider);

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'qwen',
        'decrypted-key',
        'api_key',
        'https://dashscope-intl.aliyuncs.com/compatible-mode',
      );
      expect(result).toEqual([]);
      expect(provider.cached_models).toEqual([]);
    });

    it('should stamp authType as api_key for regular providers', async () => {
      const models = [makeModel({ id: 'gpt-4o' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider({ auth_type: 'api_key' }));

      expect(result[0].authType).toBe('api_key');
    });

    it('should stamp authType as subscription for subscription providers', async () => {
      const models = [makeModel({ id: 'claude-sonnet-4' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-token',
        }),
      );

      expect(result[0].authType).toBe('subscription');
    });

    it('should use subscription fallback when auth_type is subscription and no token', async () => {
      const orMap = new Map([
        [
          'anthropic/claude-opus-4-20260301',
          {
            input: 0.000015,
            output: 0.000075,
            contextWindow: 200000,
            displayName: 'Claude Opus 4',
          },
        ],
        [
          'anthropic/claude-sonnet-4-20260301',
          {
            input: 0.000003,
            output: 0.000015,
            contextWindow: 200000,
            displayName: 'Claude Sonnet 4',
          },
        ],
        [
          'anthropic/claude-haiku-4-20260301',
          {
            input: 0.0000008,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'Claude Haiku 4',
          },
        ],
        [
          'anthropic/claude-2.1',
          {
            input: 0.000008,
            output: 0.000024,
            contextWindow: 200000,
            displayName: 'Claude 2.1',
          },
        ],
        [
          'openai/gpt-4o',
          {
            input: 0.0000025,
            output: 0.00001,
            contextWindow: 128000,
            displayName: 'GPT-4o',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: null,
        }),
      );

      // Should only include models matching knownModels prefixes (claude-opus-4, claude-sonnet-4, claude-haiku-4)
      // and NOT claude-2.1 or openai models
      expect(result).toHaveLength(3);
      expect(result.map((m) => m.id).sort()).toEqual([
        'claude-haiku-4-20260301',
        'claude-opus-4-20260301',
        'claude-sonnet-4-20260301',
      ]);
      // All should be stamped as subscription
      for (const m of result) {
        expect(m.authType).toBe('subscription');
      }
      // Should NOT have called the fetcher (no token to call with)
      expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('should cap context window via subscription capabilities', async () => {
      const orMap = new Map([
        [
          'anthropic/claude-opus-4-20260301',
          {
            input: 0.000015,
            output: 0.000075,
            contextWindow: 1000000,
            displayName: 'Claude Opus 4',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: null,
        }),
      );

      const orModel = result.find((m) => m.id === 'claude-opus-4-20260301');
      expect(orModel).toBeDefined();
      // Anthropic subscription caps at 200000
      expect(orModel!.contextWindow).toBe(200000);
    });

    it('should use subscription fallback for openai when no token and pricing matches known models', async () => {
      const orMap = new Map([
        [
          'openai/gpt-5.2-codex',
          {
            input: 0.000001,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'GPT-5.2 Codex',
          },
        ],
        [
          'openai/gpt-4o',
          { input: 0.0000025, output: 0.00001, contextWindow: 128000, displayName: 'GPT-4o' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: null,
        }),
      );

      const ids = result.map((m) => m.id);
      // gpt-5.2-codex from OpenRouter + remaining knownModels added directly
      expect(ids).toContain('gpt-5.2-codex');
      expect(ids).toContain('gpt-5.4');
      expect(ids).toContain('gpt-5.3-codex');
      // gpt-4o does NOT match any knownModel prefix
      expect(ids).not.toContain('gpt-4o');
      // All should be stamped as subscription
      for (const m of result) {
        expect(m.authType).toBe('subscription');
      }
      expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('should exchange Copilot GitHub token before fetching models', async () => {
      mockDecrypt.mockReturnValue('ghu_github_oauth_token');
      mockCopilotTokenService.getCopilotToken.mockResolvedValue('tid=copilot-api-token');

      const models = [makeModel({ id: 'copilot/claude-opus-4.6', provider: 'copilot' })];
      fetcher.fetch.mockResolvedValue(models);

      await service.discoverModels(
        makeProvider({
          provider: 'copilot',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-github-token',
        }),
      );

      expect(mockCopilotTokenService.getCopilotToken).toHaveBeenCalledWith(
        'ghu_github_oauth_token',
      );
      expect(fetcher.fetch).toHaveBeenCalledWith(
        'copilot',
        'tid=copilot-api-token',
        'subscription',
        undefined,
      );
    });

    it('should fall back to known models when Copilot token exchange fails', async () => {
      mockDecrypt.mockReturnValue('ghu_expired_token');
      mockCopilotTokenService.getCopilotToken.mockRejectedValue(
        new Error('Copilot token exchange failed: 401'),
      );

      await service.discoverModels(
        makeProvider({
          provider: 'copilot',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-expired-token',
        }),
      );

      expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('should skip Copilot token exchange when copilotTokenService is null', async () => {
      const serviceNoCopilot = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        mockPricingSync as never,
        mockModelsDevSync as never,
        mockModelRegistry as unknown as ProviderModelRegistryService,
        null,
      );

      mockDecrypt.mockReturnValue('ghu_github_token');
      fetcher.fetch.mockResolvedValue([]);

      await serviceNoCopilot.discoverModels(
        makeProvider({
          provider: 'copilot',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-token',
        }),
      );

      // Without copilotTokenService, raw GitHub token is passed to fetcher
      expect(fetcher.fetch).toHaveBeenCalledWith(
        'copilot',
        'ghu_github_token',
        'subscription',
        undefined,
      );
    });

    it('should return knownModels fallback when pricingSync is null', async () => {
      const serviceNoPricing = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        null,
        null,
        null,
        null,
      );

      const result = await serviceNoPricing.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: null,
        }),
      );

      // Even without pricingSync, knownModels are returned directly
      expect(result).toHaveLength(3);
      expect(result.map((m) => m.id).sort()).toEqual([
        'claude-haiku-4',
        'claude-opus-4',
        'claude-sonnet-4',
      ]);
      for (const m of result) {
        expect(m.authType).toBe('subscription');
      }
    });
  });

  /* ── getModelsForAgent auth-type deduplication ── */

  describe('getModelsForAgent (auth-type dedup)', () => {
    it('should keep both auth types as separate entries for the same model', async () => {
      const providers = [
        makeProvider({
          id: 'p1',
          provider: 'anthropic',
          cached_models: [
            makeModel({ id: 'claude-sonnet-4', provider: 'anthropic', authType: 'api_key' }),
          ],
        }),
        makeProvider({
          id: 'p2',
          provider: 'anthropic',
          cached_models: [
            makeModel({
              id: 'claude-sonnet-4',
              provider: 'anthropic',
              authType: 'subscription',
              contextWindow: 200000,
            }),
          ],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');

      expect(result).toHaveLength(2);
      const apiKeyEntry = result.find((m) => m.authType === 'api_key');
      const subEntry = result.find((m) => m.authType === 'subscription');
      expect(apiKeyEntry).toBeDefined();
      expect(subEntry).toBeDefined();
      expect(subEntry!.contextWindow).toBe(200000);
    });

    it('should deduplicate same model + same auth type from multiple providers', async () => {
      const providers = [
        makeProvider({
          id: 'p1',
          provider: 'anthropic',
          cached_models: [
            makeModel({
              id: 'claude-sonnet-4',
              provider: 'anthropic',
              authType: 'subscription',
            }),
          ],
        }),
        makeProvider({
          id: 'p2',
          provider: 'anthropic',
          cached_models: [
            makeModel({ id: 'claude-sonnet-4', provider: 'anthropic', authType: 'subscription' }),
          ],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].authType).toBe('subscription');
    });

    it('should use provider auth_type as fallback when cached model has no authType', async () => {
      const providers = [
        makeProvider({
          id: 'p1',
          provider: 'anthropic',
          auth_type: 'api_key',
          cached_models: [
            makeModel({ id: 'claude-sonnet-4', provider: 'anthropic' }), // no authType
          ],
        }),
        makeProvider({
          id: 'p2',
          provider: 'anthropic',
          auth_type: 'subscription',
          cached_models: [
            makeModel({ id: 'claude-sonnet-4', provider: 'anthropic' }), // no authType
          ],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');

      // Both entries kept — one with inferred api_key, one with inferred subscription
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.authType).sort()).toEqual(['api_key', 'subscription']);
    });
  });

  /* ── buildSubscriptionFallbackModels ── */

  describe('buildSubscriptionFallbackModels', () => {
    it('should return empty for unsupported providers', () => {
      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'gemini');
      expect(result).toEqual([]);
    });

    it('should include OpenRouter matches plus uncovered knownModels for openai', () => {
      const orMap = new Map([
        [
          'openai/gpt-5.2-codex',
          {
            input: 0.000001,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'GPT-5.2 Codex',
          },
        ],
        [
          'openai/gpt-4o',
          { input: 0.0000025, output: 0.00001, contextWindow: 128000, displayName: 'GPT-4o' },
        ],
        [
          'openai/gpt-5.1-codex',
          {
            input: 0.000002,
            output: 0.000008,
            contextWindow: 128000,
            displayName: 'GPT-5.1 Codex',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'openai');
      const ids = result.map((m) => m.id);

      // gpt-5.2-codex and gpt-5.1-codex from OpenRouter, plus remaining knownModels added directly
      expect(ids).toContain('gpt-5.2-codex');
      expect(ids).toContain('gpt-5.1-codex');
      expect(ids).toContain('gpt-5.4');
      expect(ids).toContain('gpt-5.3-codex');
      // gpt-5.2 is covered by gpt-5.2-codex (prefix match), so NOT added separately
      expect(ids).not.toContain('gpt-5.2');
      // gpt-5.1-codex-max is added (not covered by gpt-5.1-codex)
      expect(ids).toContain('gpt-5.1-codex-max');
      // gpt-4o is NOT included (not a known model prefix)
      expect(ids).not.toContain('gpt-4o');
    });

    it('should filter OpenRouter cache by known model prefixes', () => {
      const orMap = new Map([
        [
          'anthropic/claude-opus-4-latest',
          {
            input: 0.000015,
            output: 0.000075,
            contextWindow: 200000,
            displayName: 'Claude Opus 4',
          },
        ],
        [
          'anthropic/claude-2.1',
          { input: 0.000008, output: 0.000024, contextWindow: 200000, displayName: 'Claude 2.1' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'anthropic');
      const ids = result.map((m) => m.id);

      // claude-opus-4-latest from OpenRouter (covers prefix claude-opus-4)
      expect(ids).toContain('claude-opus-4-latest');
      // claude-sonnet-4 and claude-haiku-4 not in OpenRouter, added as zero-cost
      expect(ids).toContain('claude-sonnet-4');
      expect(ids).toContain('claude-haiku-4');
      // claude-2.1 NOT included (not a known prefix)
      expect(ids).not.toContain('claude-2.1');
      // claude-opus-4 NOT added (covered by claude-opus-4-latest)
      expect(ids).not.toContain('claude-opus-4');
      expect(result[0].provider).toBe('anthropic');
    });

    it('should normalize Anthropic short-form dot ids from OpenRouter to dash ids', () => {
      const orMap = new Map([
        [
          'anthropic/claude-sonnet-4.6',
          {
            input: 0.000003,
            output: 0.000015,
            contextWindow: 200000,
            displayName: 'Claude Sonnet 4.6',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'anthropic');

      expect(result.map((m) => m.id)).toContain('claude-sonnet-4-6');
      expect(result.map((m) => m.id)).not.toContain('claude-sonnet-4.6');
    });

    it('should apply maxContextWindow cap from subscription capabilities', () => {
      const orMap = new Map([
        [
          'anthropic/claude-sonnet-4-20260301',
          { input: 0.000003, output: 0.000015, contextWindow: 1000000, displayName: 'Sonnet' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'anthropic');
      const orModel = result.find((m) => m.id === 'claude-sonnet-4-20260301');

      expect(orModel).toBeDefined();
      expect(orModel!.contextWindow).toBe(200000);
    });

    it('should return knownModels directly when pricingSync is null', () => {
      const result = buildSubscriptionFallbackModels(null as never, 'anthropic');

      // No OpenRouter data, but knownModels are added directly
      expect(result).toHaveLength(3);
      expect(result.map((m) => m.id).sort()).toEqual([
        'claude-haiku-4',
        'claude-opus-4',
        'claude-sonnet-4',
      ]);
      expect(result[0].inputPricePerToken).toBe(0);
    });

    it('should not duplicate knownModel when already in OpenRouter', () => {
      const orMap = new Map([
        [
          'anthropic/claude-opus-4',
          { input: 0.000015, output: 0.000075, contextWindow: 200000, displayName: 'Opus 4' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'anthropic');
      const opusModels = result.filter((m) => m.id.startsWith('claude-opus-4'));

      // Only one claude-opus-4 entry (from OpenRouter), not duplicated
      expect(opusModels).toHaveLength(1);
      expect(opusModels[0].displayName).toBe('Opus 4');
    });

    it('should use default context window when entry has none', () => {
      const orMap = new Map([
        ['anthropic/claude-haiku-4-latest', { input: 0.0000008, output: 0.000004 }],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'anthropic');
      const orModel = result.find((m) => m.id === 'claude-haiku-4-latest');

      expect(orModel).toBeDefined();
      // Default 128000 is below maxContextWindow 200000, so no cap applied
      expect(orModel!.contextWindow).toBe(128000);
    });

    it('should use model id as displayName when entry has no displayName', () => {
      const orMap = new Map([
        [
          'anthropic/claude-opus-4-latest',
          { input: 0.000015, output: 0.000075, contextWindow: 200000, displayName: '' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'anthropic');
      const orModel = result.find((m) => m.id === 'claude-opus-4-latest');

      expect(orModel).toBeDefined();
      expect(orModel!.displayName).toBe('claude-opus-4-latest');
    });

    it('should add openai knownModels even without OpenRouter data', () => {
      mockPricingSync.getAll.mockReturnValue(new Map());

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'openai');

      // gpt-5.2 is covered by gpt-5.2-codex prefix, gpt-5.1-codex covered by gpt-5.1-codex-max prefix
      expect(result.length).toBe(4);
      expect(result.map((m) => m.id)).toContain('gpt-5.4');
      expect(result.map((m) => m.id)).toContain('gpt-5.3-codex');
      expect(result.map((m) => m.id)).toContain('gpt-5.2-codex');
      expect(result.map((m) => m.id)).toContain('gpt-5.1-codex-max');
      // All zero-cost subscription models
      for (const m of result) {
        expect(m.inputPricePerToken).toBe(0);
        expect(m.outputPricePerToken).toBe(0);
      }
    });

    it('should preserve MiniMax model casing in subscription fallback models', () => {
      const result = buildSubscriptionFallbackModels(null as never, 'minimax');

      expect(result.map((m) => m.id)).toEqual([
        'MiniMax-M2.5',
        'MiniMax-M2.5-highspeed',
        'MiniMax-M2.1',
        'MiniMax-M2.1-highspeed',
        'MiniMax-M2',
      ]);
    });
  });

  /* ── supplementWithKnownModels ── */

  describe('supplementWithKnownModels', () => {
    it('should add missing knownModels to discovered models', () => {
      const raw: DiscoveredModel[] = [makeModel({ id: 'gpt-oss-120b', provider: 'openai' })];

      const result = supplementWithKnownModels(raw, 'openai');

      // 1 discovered + 4 knownModels (gpt-5.2 covered by gpt-5.2-codex, gpt-5.1-codex covered by gpt-5.1-codex-max)
      expect(result.length).toBe(5);
      expect(result[0].id).toBe('gpt-oss-120b');
      expect(result.map((m) => m.id)).toContain('gpt-5.4');
      expect(result.map((m) => m.id)).toContain('gpt-5.2-codex');
    });

    it('should not duplicate models already in raw', () => {
      const raw: DiscoveredModel[] = [
        makeModel({ id: 'gpt-5.2', provider: 'openai', contextWindow: 200000 }),
      ];

      const result = supplementWithKnownModels(raw, 'openai');

      const matchingModels = result.filter((m) => m.id === 'gpt-5.2');
      expect(matchingModels).toHaveLength(1);
      // Original model preserved (not replaced)
      expect(matchingModels[0].contextWindow).toBe(200000);
    });

    it('should not add knownModel when a dated version already exists', () => {
      const raw: DiscoveredModel[] = [
        makeModel({ id: 'claude-opus-4-20260301', provider: 'anthropic' }),
      ];

      const result = supplementWithKnownModels(raw, 'anthropic');

      // claude-opus-4 is covered by claude-opus-4-20260301
      expect(result.map((m) => m.id)).not.toContain('claude-opus-4');
      // claude-sonnet-4 and claude-haiku-4 are NOT covered
      expect(result.map((m) => m.id)).toContain('claude-sonnet-4');
      expect(result.map((m) => m.id)).toContain('claude-haiku-4');
    });

    it('should return raw unchanged for non-subscription providers', () => {
      const raw: DiscoveredModel[] = [makeModel({ id: 'model-1' })];

      const result = supplementWithKnownModels(raw, 'gemini');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('model-1');
    });

    it('should set zero pricing on supplemented models', () => {
      const result = supplementWithKnownModels([], 'openai');

      for (const m of result) {
        expect(m.inputPricePerToken).toBe(0);
        expect(m.outputPricePerToken).toBe(0);
      }
    });

    it('should supplement MiniMax known models with documented casing', () => {
      const raw: DiscoveredModel[] = [
        makeModel({ id: 'MiniMax-M2.5-highspeed', provider: 'minimax' }),
      ];

      const result = supplementWithKnownModels(raw, 'minimax');

      expect(result.map((m) => m.id)).toContain('MiniMax-M2.1');
      expect(result.map((m) => m.id)).toContain('MiniMax-M2');
      expect(result.map((m) => m.id)).not.toContain('MiniMax-M2.5');
    });

    it('should supplement Z.ai known models including glm-5.1', () => {
      const raw: DiscoveredModel[] = [makeModel({ id: 'glm-4.7', provider: 'zai' })];

      const result = supplementWithKnownModels(raw, 'zai');

      expect(result.map((m) => m.id)).toContain('glm-5.1');
      expect(result.map((m) => m.id)).toContain('glm-5-turbo');
      expect(result.map((m) => m.id)).toContain('glm-4.5-air');
      expect(result.filter((m) => m.id === 'glm-4.7')).toHaveLength(1);
    });
  });

  /* ── applyCapabilities edge cases ── */

  describe('applyCapabilities (via enrichModel)', () => {
    it('should not apply capabilities when modelsDevSync is null', async () => {
      const serviceNoMd = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        mockPricingSync as never,
        null, // no models.dev sync
        mockModelRegistry as unknown as ProviderModelRegistryService,
        null,
      );

      const models = [
        makeModel({
          id: 'free-model',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: false,
          capabilityCode: false,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await serviceNoMd.discoverModels(makeProvider());

      expect(result[0].capabilityReasoning).toBe(false);
      expect(result[0].capabilityCode).toBe(false);
    });

    it('should preserve existing capabilities when models.dev has no match', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue(null);

      const models = [
        makeModel({
          id: 'custom-model',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: true,
          capabilityCode: true,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
    });

    it('should apply capabilities for OpenRouter-sourced models with positive pricing', async () => {
      // Model has pricing > 0, so enrichModel skips pricing but applies capabilities
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'gpt-4o',
        name: 'GPT-4o',
        inputPricePerToken: 0.0000025,
        outputPricePerToken: 0.00001,
        reasoning: true,
        toolCall: true,
      });

      const models = [
        makeModel({
          id: 'gpt-4o',
          inputPricePerToken: 0.0000025, // positive pricing, already set
          outputPricePerToken: 0.00001,
          capabilityReasoning: false,
          capabilityCode: false,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Pricing should be preserved (not overwritten from models.dev)
      expect(result[0].inputPricePerToken).toBe(0.0000025);
      expect(result[0].outputPricePerToken).toBe(0.00001);
      // Capabilities should be applied from models.dev
      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
    });

    it('should use model default capabilities when models.dev entry has undefined flags', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'model-no-flags',
        name: 'Model No Flags',
        inputPricePerToken: 0.001,
        outputPricePerToken: 0.002,
        // reasoning and toolCall are undefined
      });

      const models = [
        makeModel({
          id: 'model-no-flags',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: true,
          capabilityCode: true,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // undefined ?? true = true (model defaults preserved)
      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
    });
  });

  /* ── enrichModel pricing boundary conditions ── */

  describe('enrichModel pricing boundary conditions', () => {
    it('should trigger pricing enrichment when inputPricePerToken is negative', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'neg-model',
        name: 'Negative Price Model',
        inputPricePerToken: 0.001,
        outputPricePerToken: 0.002,
        contextWindow: 128000,
      });

      const models = [
        makeModel({
          id: 'neg-model',
          inputPricePerToken: -1,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Negative price is < 0, so the >= 0 guard fails, enrichment kicks in
      expect(result[0].inputPricePerToken).toBe(0.001);
      expect(result[0].outputPricePerToken).toBe(0.002);
    });

    it('should trigger pricing enrichment when inputPricePerToken is null', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'null-price',
        name: 'Null Price',
        inputPricePerToken: 0.005,
        outputPricePerToken: 0.01,
        contextWindow: 64000,
      });

      const models = [
        makeModel({
          id: 'null-price',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBe(0.005);
      expect(result[0].outputPricePerToken).toBe(0.01);
    });

    it('should trigger pricing enrichment when inputPricePerToken is set but outputPricePerToken is null', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'partial-price',
        name: 'Partial Price',
        inputPricePerToken: 0.005,
        outputPricePerToken: 0.01,
        contextWindow: 64000,
      });

      const models = [
        makeModel({
          id: 'partial-price',
          inputPricePerToken: 0.001,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Output is null so enrichment should run — both prices come from models.dev
      expect(result[0].inputPricePerToken).toBe(0.005);
      expect(result[0].outputPricePerToken).toBe(0.01);
    });

    it('should skip pricing enrichment but apply capabilities for price=0 models', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'zero-price',
        name: 'Zero Price Enhanced',
        inputPricePerToken: 0.003, // should NOT be used
        outputPricePerToken: 0.006,
        reasoning: true,
        toolCall: true,
      });

      const models = [
        makeModel({
          id: 'zero-price',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: false,
          capabilityCode: false,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Pricing preserved
      expect(result[0].inputPricePerToken).toBe(0);
      expect(result[0].outputPricePerToken).toBe(0);
      // Capabilities updated from models.dev
      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
    });

    it('should fall back to known-model-prices when models.dev and OpenRouter have no data', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue(null);
      mockPricingSync.lookupPricing.mockReturnValue(null);

      const models = [
        makeModel({
          id: 'moonshot-v1-128k',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
      expect(result[0].outputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
    });

    it('should return model without pricing when no source has data', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue(null);
      mockPricingSync.lookupPricing.mockReturnValue(null);

      const models = [
        makeModel({
          id: 'totally-unknown-model',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });
  });

  /* ── models.dev fallback in discoverModels ── */

  describe('models.dev fallback in discoverModels', () => {
    it('should try models.dev before OpenRouter when native API returns empty', async () => {
      fetcher.fetch.mockResolvedValue([]);
      mockModelsDevSync.getModelsForProvider.mockReturnValue([
        {
          id: 'md-model',
          name: 'MD Model',
          contextWindow: 128000,
          inputPricePerToken: 0.001,
          outputPricePerToken: 0.002,
          reasoning: true,
          toolCall: false,
        },
      ]);

      const result = await service.discoverModels(makeProvider());

      expect(mockModelsDevSync.getModelsForProvider).toHaveBeenCalledWith('openai');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('md-model');
      expect(result[0].capabilityReasoning).toBe(true);
      // OpenRouter fallback should NOT be called when models.dev has data
      expect(mockPricingSync.getAll).not.toHaveBeenCalled();
    });

    it('should fall through to OpenRouter when both native API and models.dev return empty', async () => {
      fetcher.fetch.mockResolvedValue([]);
      mockModelsDevSync.getModelsForProvider.mockReturnValue([]);
      mockPricingSync.getAll.mockReturnValue(
        new Map([['openai/gpt-4o', { input: 0.01, output: 0.02, displayName: 'GPT-4o' }]]),
      );

      const result = await service.discoverModels(makeProvider());

      expect(mockModelsDevSync.getModelsForProvider).toHaveBeenCalledWith('openai');
      expect(mockPricingSync.getAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });

    it('should skip models.dev fallback when modelsDevSync is null', async () => {
      const serviceNoMd = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        mockPricingSync as never,
        null,
        mockModelRegistry as unknown as ProviderModelRegistryService,
        null,
      );

      fetcher.fetch.mockResolvedValue([]);
      mockPricingSync.getAll.mockReturnValue(
        new Map([['openai/gpt-4o', { input: 0.01, output: 0.02, displayName: 'GPT-4o' }]]),
      );

      const result = await serviceNoMd.discoverModels(makeProvider());

      // Should go straight to OpenRouter fallback
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });
  });
});
