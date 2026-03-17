import { ModelDiscoveryService } from './model-discovery.service';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { DiscoveredModel } from './model-fetcher';
import { buildSubscriptionFallbackModels, supplementWithKnownModels } from './model-fallback';

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
      expect(result[0].id).toBe('claude-opus-4.6');
      expect(result[0].displayName).toBe('Claude Opus 4.6');
      expect(result[0].inputPricePerToken).toBe(0.000015);
      expect(result[0].provider).toBe('anthropic');
      expect(result[1].id).toBe('claude-sonnet-4.6');
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

    it('should return knownModels fallback when pricingSync is null', async () => {
      const serviceNoPricing = new ModelDiscoveryService(
        providerRepo as never,
        customProviderRepo as never,
        fetcher as unknown as ProviderModelFetcherService,
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
    it('should prefer subscription model over api_key duplicate', async () => {
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

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claude-sonnet-4');
      expect(result[0].authType).toBe('subscription');
      expect(result[0].contextWindow).toBe(200000);
    });

    it('should not replace subscription with api_key duplicate', async () => {
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
            makeModel({ id: 'claude-sonnet-4', provider: 'anthropic', authType: 'api_key' }),
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

      expect(result).toHaveLength(1);
      // Legacy model from subscription provider should replace the api_key one
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
  });
});
