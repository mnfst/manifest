import { ModelDiscoveryService } from './model-discovery.service';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { DiscoveredModel } from './model-fetcher';

jest.mock('../../common/utils/crypto.util', () => ({
  decrypt: jest.fn(),
  getEncryptionSecret: jest.fn(),
}));

jest.mock('../../database/quality-score.util', () => ({
  computeQualityScore: jest.fn().mockReturnValue(3),
}));

import { decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { computeQualityScore } from '../../database/quality-score.util';

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

  beforeEach(() => {
    providerRepo = makeMockRepo();
    customProviderRepo = makeMockRepo();
    fetcher = { fetch: jest.fn().mockResolvedValue([]) };
    mockPricingSync = {
      lookupPricing: jest.fn().mockReturnValue(null),
      getAll: jest.fn().mockReturnValue(new Map()),
    };

    mockDecrypt.mockReturnValue('decrypted-key');
    mockGetSecret.mockReturnValue('secret-32-chars-long-xxxxxxxxxx');
    mockComputeScore.mockReturnValue(3);

    service = new ModelDiscoveryService(
      providerRepo as never,
      customProviderRepo as never,
      fetcher as unknown as ProviderModelFetcherService,
      mockPricingSync as never,
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
      expect(fetcher.fetch).toHaveBeenCalledWith('openai', 'decrypted-key', 'api_key');
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
      expect(fetcher.fetch).toHaveBeenCalledWith('openai', '', 'api_key');
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

    it('should fall back to manual pricing when pricingSync lookup returns null', async () => {
      // mockPricingSync.lookupPricing returns null by default

      // Use a model ID that exists in MANUAL_PRICING
      const models = [makeModel({ id: 'glm-5' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBe(0.000005);
      expect(result[0].outputPricePerToken).toBe(0.000005);
    });

    it('should fall back to manual pricing when pricingSync is null', async () => {
      const serviceNoPricing = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
        null,
      );

      const models = [makeModel({ id: 'glm-5' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await serviceNoPricing.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBe(0.000005);
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
    it('should use pricingSync lookup when fetcher provided zero pricing', async () => {
      // inputPricePerToken is 0, which is not > 0, so enrichModel continues to lookup
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
      // Should have gone through pricingSync lookup since 0 is not > 0
      expect(mockPricingSync.lookupPricing).toHaveBeenCalled();
      expect(result[0].inputPricePerToken).toBe(0.001);
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

    it('should call computeQualityScore with correct params for manual pricing', async () => {
      mockComputeScore.mockReturnValue(4);

      const models = [makeModel({ id: 'glm-5' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(mockComputeScore).toHaveBeenCalledWith(
        expect.objectContaining({
          model_name: 'glm-5',
          input_price_per_token: 0.000005,
          output_price_per_token: 0.000005,
        }),
      );
      expect(result[0].qualityScore).toBe(4);
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
  });
});
