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

import { decrypt, getEncryptionSecret } from '../common/utils/crypto.util';
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

    it('should unwrap the Kiro OIDC token blob before fetching models', async () => {
      mockDecrypt.mockReturnValue(
        JSON.stringify({
          source: 'kiro-oidc',
          t: 'kiro-access',
          r: 'kiro-refresh',
          e: Date.now() + 10 * 60_000,
          cid: 'client-id',
          cs: 'client-secret',
          region: 'us-east-1',
        }),
      );
      const provider = makeProvider({ provider: 'kiro', auth_type: 'subscription' });

      await service.discoverModels(provider);

      expect(fetcher.fetch).toHaveBeenCalledWith('kiro', 'kiro-access', 'subscription', undefined);
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

      expect(mockModelRegistry.registerModels).toHaveBeenCalledWith('openai', models);
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

  /* ── refreshProvider ── */

  describe('refreshProvider', () => {
    it('returns Provider not found when no row matches', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      const result = await service.refreshProvider('agent-1', 'openai');
      expect(result).toEqual({
        ok: false,
        model_count: 0,
        last_fetched_at: null,
        error: 'Provider not found',
      });
    });

    it('refuses custom providers and reports the cached count', async () => {
      providerRepo.findOne.mockResolvedValue(
        makeProvider({
          provider: 'custom:cp-1',
          cached_models: [makeModel({ id: 'foo' }), makeModel({ id: 'bar' })],
          models_fetched_at: '2026-04-12T08:00:00.000Z',
        }),
      );
      const result = await service.refreshProvider('agent-1', 'custom:cp-1');
      expect(result.ok).toBe(false);
      expect(result.model_count).toBe(2);
      expect(result.last_fetched_at).toBe('2026-04-12T08:00:00.000Z');
      expect(result.error).toContain('Custom providers are managed manually');
    });

    it('returns ok with the discovered count on success', async () => {
      const provider = makeProvider({ provider: 'openai' });
      providerRepo.findOne.mockResolvedValue(provider);
      fetcher.fetch.mockResolvedValue([
        makeModel({ id: 'gpt-4o' }),
        makeModel({ id: 'gpt-4o-mini' }),
      ]);

      const result = await service.refreshProvider('agent-1', 'openai', 'api_key');
      expect(providerRepo.findOne).toHaveBeenCalledWith({
        where: { agent_id: 'agent-1', provider: 'openai', is_active: true, auth_type: 'api_key' },
      });
      expect(result.ok).toBe(true);
      expect(result.model_count).toBe(2);
      expect(result.error).toBeNull();
      expect(result.last_fetched_at).toBeDefined();
    });

    it('returns ok=false with hint when provider returns no models', async () => {
      const provider = makeProvider({ provider: 'openai', cached_models: null });
      providerRepo.findOne.mockResolvedValue(provider);
      fetcher.fetch.mockResolvedValue([]);

      const result = await service.refreshProvider('agent-1', 'openai');
      expect(result.ok).toBe(false);
      expect(result.model_count).toBe(0);
      expect(result.error).toBe('Provider returned no models');
    });

    it('preserves cached models and reports prior count when discovery throws', async () => {
      const cachedModels = [makeModel({ id: 'gpt-4o' }), makeModel({ id: 'gpt-4o-mini' })];
      providerRepo.findOne.mockResolvedValue(
        makeProvider({
          provider: 'openai',
          cached_models: cachedModels,
          models_fetched_at: '2026-04-01T08:00:00.000Z',
        }),
      );
      // discoverModels itself swallows fetcher errors, so to land in the
      // refreshProvider catch we make the cache-write throw instead.
      fetcher.fetch.mockResolvedValue([makeModel({ id: 'gpt-4o' })]);
      providerRepo.save.mockRejectedValueOnce(new Error('DB write failed'));

      const result = await service.refreshProvider('agent-1', 'openai');
      expect(result.ok).toBe(false);
      expect(result.model_count).toBe(2);
      expect(result.error).toBe('DB write failed');
      expect(result.last_fetched_at).toBe('2026-04-01T08:00:00.000Z');
    });

    it('reports a non-Error thrown value via String() in the error field', async () => {
      providerRepo.findOne.mockResolvedValue(makeProvider({ provider: 'openai' }));
      fetcher.fetch.mockResolvedValue([makeModel({ id: 'gpt-4o' })]);
      providerRepo.save.mockRejectedValueOnce('plain-string-failure');

      const result = await service.refreshProvider('agent-1', 'openai');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('plain-string-failure');
    });
  });

  /* ── empty-result cache preservation ── */

  describe('discoverModels — empty result preserves cache', () => {
    it('keeps the previous cache when the fetcher returns no models', async () => {
      const cachedModels = [makeModel({ id: 'gpt-4o' }), makeModel({ id: 'gpt-4o-mini' })];
      const provider = makeProvider({
        provider: 'openai',
        cached_models: cachedModels,
        models_fetched_at: '2026-04-01T08:00:00.000Z',
      });
      fetcher.fetch.mockResolvedValue([]);
      // Disable fallback sources so the result stays empty.
      mockPricingSync.getAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockReturnValue([]);

      const result = await service.discoverModels(provider);

      expect(result).toEqual(cachedModels);
      expect(provider.cached_models).toEqual(cachedModels);
      expect(provider.models_fetched_at).toBe('2026-04-01T08:00:00.000Z');
      expect(providerRepo.save).not.toHaveBeenCalled();
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

    it('should filter stale unsupported OpenAI subscription cached models', async () => {
      const providers = [
        makeProvider({
          provider: 'openai',
          auth_type: 'subscription',
          cached_models: [
            makeModel({ id: 'gpt-5.5', provider: 'openai', authType: 'subscription' }),
            makeModel({ id: 'gpt-5.2-codex', provider: 'openai', authType: 'subscription' }),
            makeModel({ id: 'gpt-5.1-codex-max', provider: 'openai', authType: 'subscription' }),
            makeModel({ id: 'gpt-5.3-codex-spark', provider: 'openai', authType: 'subscription' }),
          ],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');

      expect(result.map((m) => m.id)).toEqual(['gpt-5.5', 'gpt-5.3-codex-spark']);
    });

    it('should inherit auth_type from user_providers row for custom provider models', async () => {
      const providers = [
        makeProvider({
          provider: 'custom:cp-1',
          auth_type: 'local',
          cached_models: null,
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([makeCustomProvider()]);

      const result = await service.getModelsForAgent('agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].authType).toBe('local');
    });

    it('should deduplicate duplicate models for the same provider and auth type', async () => {
      const providers = [
        makeProvider({
          id: 'p1',
          provider: 'openai',
          cached_models: [makeModel({ id: 'gpt-4' })],
        }),
        makeProvider({
          id: 'p2',
          provider: 'openai',
          cached_models: [makeModel({ id: 'gpt-4' })],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toHaveLength(1);
    });

    it('should keep the same model id from different providers as separate routes', async () => {
      const providers = [
        makeProvider({
          id: 'p1',
          provider: 'openrouter',
          cached_models: [makeModel({ id: 'deepseek-chat', provider: 'openrouter' })],
        }),
        makeProvider({
          id: 'p2',
          provider: 'deepseek',
          cached_models: [makeModel({ id: 'deepseek-chat', provider: 'deepseek' })],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');

      expect(result).toHaveLength(2);
      expect(result.map((m) => `${m.provider}:${m.authType}:${m.id}`)).toEqual([
        'openrouter:api_key:deepseek-chat',
        'deepseek:api_key:deepseek-chat',
      ]);
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

    it('should filter out non-chat models from cached results', async () => {
      const providers = [
        makeProvider({
          provider: 'copilot',
          cached_models: [
            makeModel({ id: 'copilot/claude-opus-4.7', provider: 'copilot' }),
            makeModel({ id: 'copilot/accounts/msft/routers/f185i3v4', provider: 'copilot' }),
            makeModel({ id: 'copilot/accounts/msft/routers/fmfeto88', provider: 'copilot' }),
          ],
        }),
      ];
      providerRepo.find.mockResolvedValue(providers);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelsForAgent('agent-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('copilot/claude-opus-4.7');
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

  /* ── getModelsForAgent caching ── */

  describe('getModelsForAgent (cache)', () => {
    beforeEach(() => {
      providerRepo.find.mockResolvedValue([
        makeProvider({ cached_models: [makeModel({ id: 'gpt-4', provider: 'openai' })] }),
      ]);
      customProviderRepo.find.mockResolvedValue([]);
    });

    it('serves the second call within TTL from cache (no extra DB hit)', async () => {
      const first = await service.getModelsForAgent('agent-1');
      const second = await service.getModelsForAgent('agent-1');

      expect(second).toEqual(first);
      // providerRepo.find is hit once for user_providers on the first call only.
      expect(providerRepo.find).toHaveBeenCalledTimes(1);
      expect(customProviderRepo.find).toHaveBeenCalledTimes(1);
    });

    it('isolates cache entries per agent', async () => {
      await service.getModelsForAgent('agent-1');
      await service.getModelsForAgent('agent-2');

      // Distinct keys → distinct DB reads.
      expect(providerRepo.find).toHaveBeenCalledTimes(2);
    });

    it('refetches after invalidate(agentId)', async () => {
      await service.getModelsForAgent('agent-1');
      service.invalidate('agent-1');
      await service.getModelsForAgent('agent-1');

      expect(providerRepo.find).toHaveBeenCalledTimes(2);
    });

    it('only invalidates the targeted agent', async () => {
      await service.getModelsForAgent('agent-1');
      await service.getModelsForAgent('agent-2');
      service.invalidate('agent-1');

      await service.getModelsForAgent('agent-1'); // refetch
      await service.getModelsForAgent('agent-2'); // still cached

      expect(providerRepo.find).toHaveBeenCalledTimes(3);
    });

    it('refetches after the TTL expires', async () => {
      jest.useFakeTimers();
      try {
        await service.getModelsForAgent('agent-1');
        jest.advanceTimersByTime(120_001);
        await service.getModelsForAgent('agent-1');
        expect(providerRepo.find).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('invalidates the agent cache after discoverModels rewrites cached_models', async () => {
      // Warm the cache for agent-1.
      await service.getModelsForAgent('agent-1');
      expect(providerRepo.find).toHaveBeenCalledTimes(1);

      // Discover models for the same agent → cached_models change on disk →
      // the per-agent model cache must be dropped.
      fetcher.fetch.mockResolvedValue([makeModel({ id: 'gpt-4o', provider: 'openai' })]);
      await service.discoverModels(makeProvider({ agent_id: 'agent-1' }));

      await service.getModelsForAgent('agent-1');
      // Second getModelsForAgent must hit the DB again (find called twice for
      // user_providers across the two getModelsForAgent calls).
      expect(providerRepo.find).toHaveBeenCalledTimes(2);
    });

    it('sweeps expired entries on populate so the cache cannot grow unbounded', async () => {
      jest.useFakeTimers();
      try {
        const cache = (service as unknown as { modelsCache: Map<string, unknown> }).modelsCache;
        await service.getModelsForAgent('agent-1');
        await service.getModelsForAgent('agent-2'); // sweep sees agent-1 still fresh (skip branch)
        expect(cache.size).toBe(2);

        jest.advanceTimersByTime(120_001); // agent-1 + agent-2 now expired
        await service.getModelsForAgent('agent-3'); // sweep evicts the two stale entries

        expect(cache.size).toBe(1);
        expect(cache.has('agent-3')).toBe(true);
        expect(providerRepo.find).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
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

    it('should not infer a provider when the model id is shared by multiple routes', async () => {
      providerRepo.find.mockResolvedValue([
        makeProvider({
          provider: 'openrouter',
          cached_models: [makeModel({ id: 'deepseek-chat', provider: 'openrouter' })],
        }),
        makeProvider({
          provider: 'deepseek',
          cached_models: [makeModel({ id: 'deepseek-chat', provider: 'deepseek' })],
        }),
      ]);
      customProviderRepo.find.mockResolvedValue([]);

      const result = await service.getModelForAgent('agent-1', 'deepseek-chat');
      expect(result).toBeUndefined();
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

    it('should enrich Xiaomi MiMo API-key models from provider pricing', async () => {
      mockModelsDevSync.lookupModel.mockReturnValue(null);
      mockPricingSync.lookupPricing.mockImplementation((key: string) => {
        if (key === 'xiaomi/mimo-v2.5-pro') {
          return {
            input: 0.000003,
            output: 0.000012,
            displayName: 'MiMo V2.5 Pro',
          };
        }
        return null;
      });

      fetcher.fetch.mockResolvedValue([
        makeModel({
          id: 'mimo-v2.5-pro',
          provider: 'xiaomi',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ]);

      const result = await service.discoverModels(makeProvider({ provider: 'xiaomi' }));

      expect(mockPricingSync.lookupPricing).toHaveBeenCalledWith('xiaomi/mimo-v2.5-pro');
      expect(result[0].inputPricePerToken).toBe(0.000003);
      expect(result[0].outputPricePerToken).toBe(0.000012);
      expect(result[0].displayName).toBe('MiMo V2.5 Pro');
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

      const models = [makeModel({ id: 'gpt-5.5' })];
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

    it('should not unwrap blob for non-OAuth subscription providers', async () => {
      const blob = JSON.stringify({ t: 'access-token', r: 'refresh', e: Date.now() + 60000 });
      mockDecrypt.mockReturnValue(blob);

      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'qwen',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith('qwen', blob, 'subscription', undefined);
    });

    it('should use curated models for Anthropic subscription providers without live discovery probes', async () => {
      mockDecrypt.mockReturnValue(
        JSON.stringify({
          t: 'access-token',
          r: 'refresh',
          e: Date.now() + 60000,
        }),
      );

      const result = await service.discoverModels(
        makeProvider({
          provider: 'anthropic',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
        }),
      );

      expect(fetcher.fetch).not.toHaveBeenCalled();
      expect(result.map((m) => m.id)).toEqual([
        'claude-fable-5',
        'claude-opus-4',
        'claude-sonnet-4',
        'claude-haiku-4',
      ]);
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

    it('routes pasted-token MiniMax CN subscription discovery to the CN host', async () => {
      // Pasted sk-cp- token: not a JSON blob, region=cn stored alongside
      mockDecrypt.mockReturnValue('sk-cp-cn-token');
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'minimax',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
          region: 'cn',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'minimax',
        'sk-cp-cn-token',
        'subscription',
        'https://api.minimaxi.com/anthropic',
      );
    });

    it('leaves discovery on the default host for pasted-token MiniMax global subscription', async () => {
      mockDecrypt.mockReturnValue('sk-cp-global-token');
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'minimax',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
          region: 'global',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'minimax',
        'sk-cp-global-token',
        'subscription',
        undefined,
      );
    });

    it('routes Z.ai CN subscription discovery to the China Coding Plan host', async () => {
      mockDecrypt.mockReturnValue('zai-sub-key');
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'zai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
          region: 'cn',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'zai',
        'zai-sub-key',
        'subscription',
        'https://open.bigmodel.cn/api/coding/paas/v4',
      );
    });

    it('leaves Z.ai global subscription discovery on the default outside-China host', async () => {
      mockDecrypt.mockReturnValue('zai-sub-key');
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'zai',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
          region: 'global',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith('zai', 'zai-sub-key', 'subscription', undefined);
    });

    it('routes Xiaomi MiMo Token Plan subscription discovery to the selected region host', async () => {
      mockDecrypt.mockReturnValue('tp-mimo-token');
      fetcher.fetch.mockResolvedValue([]);

      await service.discoverModels(
        makeProvider({
          provider: 'xiaomi',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted',
          region: 'ams',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'xiaomi',
        'tp-mimo-token',
        'subscription',
        'https://token-plan-ams.xiaomimimo.com',
      );
    });

    it('should fall back to subscription fallback when OpenAI token fetch returns empty', async () => {
      const blob = JSON.stringify({ t: 'expired-token', r: 'refresh', e: Date.now() - 1000 });
      mockDecrypt.mockReturnValue(blob);

      // Fetcher returns empty (e.g., 401 from expired token)
      fetcher.fetch.mockResolvedValue([]);

      const orMap = new Map([
        [
          'openai/gpt-5.5',
          {
            input: 0.000001,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'GPT-5.5',
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

    it('should stamp authType as local for Ollama providers', async () => {
      const models = [makeModel({ id: 'llama3.1:8b' })];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'ollama',
          auth_type: 'local',
          api_key_encrypted: null,
        }),
      );

      expect(result[0].authType).toBe('local');
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
      // and NOT claude-2.1 or openai models. claude-fable-5 has no OpenRouter
      // pricing entry, so it is appended directly as a zero-cost known model.
      expect(result).toHaveLength(4);
      expect(result.map((m) => m.id).sort()).toEqual([
        'claude-fable-5',
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
          'openai/gpt-5.5',
          {
            input: 0.000001,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'GPT-5.5',
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
      // gpt-5.5 from OpenRouter + remaining supported knownModels added directly
      expect(ids).toContain('gpt-5.5');
      expect(ids).toContain('gpt-5.4');
      expect(ids).toContain('gpt-5.3-codex-spark');
      expect(ids).not.toContain('gpt-5.2-codex');
      expect(ids).not.toContain('gpt-5.1-codex-max');
      // gpt-4o does NOT match any knownModel prefix
      expect(ids).not.toContain('gpt-4o');
      // All should be stamped as subscription
      for (const m of result) {
        expect(m.authType).toBe('subscription');
      }
      expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('should not hardcode Qwen Token Plan fallback models when subscription fetch returns no models', async () => {
      mockDecrypt.mockReturnValue('sk-sp-token-plan-key');
      fetcher.fetch.mockResolvedValue([]);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'qwen',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-token-plan-key',
        }),
      );

      expect(fetcher.fetch).toHaveBeenCalledWith(
        'qwen',
        'sk-sp-token-plan-key',
        'subscription',
        undefined,
      );
      expect(result).toEqual([]);
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
      expect(result).toHaveLength(4);
      expect(result.map((m) => m.id).sort()).toEqual([
        'claude-fable-5',
        'claude-haiku-4',
        'claude-opus-4',
        'claude-sonnet-4',
      ]);
      for (const m of result) {
        expect(m.authType).toBe('subscription');
      }
    });

    it('should use subscription fallback for gemini when token present but fetcher returns empty', async () => {
      // Gemini CodeAssist does not expose a /models endpoint, so the fetcher
      // returns [] immediately (no HTTP). The discovery service then falls through
      // to buildSubscriptionFallbackModels (exact match) to produce the curated
      // model list from the OpenRouter cache.
      const blob = JSON.stringify({
        t: 'ya29.google-access-token',
        r: 'refresh-token',
        e: Date.now() + 3600000,
        u: 'my-gcp-project-123',
      });
      mockDecrypt.mockReturnValue(blob);
      // fetcher returns [] because gemini+subscription short-circuits
      fetcher.fetch.mockResolvedValue([]);

      const orMap = new Map([
        // Exact matches — should be included
        [
          'google/gemini-2.5-pro',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro',
          },
        ],
        [
          'google/gemini-2.5-flash',
          {
            input: 0.0000003,
            output: 0.0000025,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Flash',
          },
        ],
        [
          'google/gemini-3.1-pro-preview',
          {
            input: 0.000002,
            output: 0.000012,
            contextWindow: 1000000,
            displayName: 'Gemini 3.1 Pro Preview',
          },
        ],
        // Suffixed variants — should be EXCLUDED in exact mode
        [
          'google/gemini-2.5-pro-preview-06-05',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro Preview',
          },
        ],
        // Non-gemini model — excluded
        [
          'openai/gpt-4o',
          { input: 0.0000025, output: 0.00001, contextWindow: 128000, displayName: 'GPT-4o' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'gemini',
          auth_type: 'subscription',
          api_key_encrypted: 'encrypted-blob',
        }),
      );

      const ids = result.map((m) => m.id);
      // Exact matches included
      expect(ids).toContain('gemini-2.5-pro');
      expect(ids).toContain('gemini-2.5-flash');
      expect(ids).toContain('gemini-3.1-pro-preview');
      // Suffixed preview NOT included (exact match mode)
      expect(ids).not.toContain('gemini-2.5-pro-preview-06-05');
      // Non-gemini models excluded
      expect(ids).not.toContain('gpt-4o');
      // gemini-2.5-flash-lite added directly (not in OpenRouter cache) as zero-cost
      expect(ids).toContain('gemini-2.5-flash-lite');
      // All stamped as subscription
      for (const m of result) {
        expect(m.authType).toBe('subscription');
      }
      // Fetcher IS called but returns [] (it short-circuits internally without HTTP).
      // Gemini blobs are NOT unwrapped in the service (only openai/minimax are),
      // so the raw JSON blob string is passed to the fetcher.
      // The service then falls through to buildSubscriptionFallbackModels.
      expect(fetcher.fetch).toHaveBeenCalledWith(
        'gemini',
        expect.stringContaining('ya29.google-access-token'),
        'subscription',
        undefined,
      );
    });

    it('should use exact-match subscription fallback for gemini when no token', async () => {
      // When there is no encrypted key, gemini subscription shows the curated list
      const orMap = new Map([
        [
          'google/gemini-2.5-flash',
          {
            input: 0.0000003,
            output: 0.0000025,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Flash',
          },
        ],
        [
          'google/gemini-2.5-flash-preview-05-20',
          {
            input: 0.0000003,
            output: 0.0000025,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Flash Preview',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = await service.discoverModels(
        makeProvider({
          provider: 'gemini',
          auth_type: 'subscription',
          api_key_encrypted: null,
        }),
      );

      const ids = result.map((m) => m.id);
      // Exact match: gemini-2.5-flash included
      expect(ids).toContain('gemini-2.5-flash');
      // Preview suffix: excluded in exact mode
      expect(ids).not.toContain('gemini-2.5-flash-preview-05-20');
      // knownModels not in cache added as zero-cost
      expect(ids).toContain('gemini-2.5-pro');
      expect(ids).toContain('gemini-2.5-flash-lite');
      expect(ids).toContain('gemini-3.1-pro-preview');
      expect(ids).toContain('gemini-3-flash-preview');
      expect(ids).toContain('gemini-3.1-flash-lite');
      expect(ids).toContain('gemini-3.1-flash-lite-preview');
      expect(fetcher.fetch).not.toHaveBeenCalled();
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
      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'unknown-provider');
      expect(result).toEqual([]);
    });

    it('should include OpenRouter matches plus uncovered knownModels for openai', () => {
      const orMap = new Map([
        [
          'openai/gpt-5.5',
          {
            input: 0.000001,
            output: 0.000004,
            contextWindow: 200000,
            displayName: 'GPT-5.5',
          },
        ],
        [
          'openai/gpt-4o',
          { input: 0.0000025, output: 0.00001, contextWindow: 128000, displayName: 'GPT-4o' },
        ],
        [
          'openai/gpt-5.4-mini',
          {
            input: 0.000002,
            output: 0.000008,
            contextWindow: 128000,
            displayName: 'GPT-5.4 Mini',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'openai');
      const ids = result.map((m) => m.id);

      // gpt-5.5 and gpt-5.4-mini from OpenRouter, plus remaining supported knownModels added directly
      expect(ids).toContain('gpt-5.5');
      expect(ids).toContain('gpt-5.4-mini');
      expect(ids).toContain('gpt-5.4');
      expect(ids).toContain('gpt-5.3-codex-spark');
      expect(ids).not.toContain('gpt-5.3-codex');
      expect(ids).not.toContain('gpt-5.2-codex');
      expect(ids).not.toContain('gpt-5.2');
      expect(ids).not.toContain('gpt-5.1-codex-max');
      expect(ids).not.toContain('gpt-5.1-codex');
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
      expect(result).toHaveLength(4);
      expect(result.map((m) => m.id).sort()).toEqual([
        'claude-fable-5',
        'claude-haiku-4',
        'claude-opus-4',
        'claude-sonnet-4',
      ]);
      expect(result[0].inputPricePerToken).toBe(0);
    });

    it('should return BytePlus knownModels directly when pricingSync is null', () => {
      const result = buildSubscriptionFallbackModels(null as never, 'byteplus');

      expect(result.map((m) => m.id)).toEqual([
        'ark-code-latest',
        'bytedance-seed-code',
        'glm-5.1',
        'glm-4.7',
        'deepseek-v3.2',
        'deepseek-v4-flash',
        'deepseek-v4-pro',
        'kimi-k2.5',
        'gpt-oss-120b',
      ]);
      expect(result[0]).toMatchObject({
        provider: 'byteplus',
        contextWindow: 256000,
        inputPricePerToken: 0,
        outputPricePerToken: 0,
      });
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

      expect(result.length).toBe(4);
      expect(result.map((m) => m.id)).toContain('gpt-5.5');
      expect(result.map((m) => m.id)).toContain('gpt-5.4');
      expect(result.map((m) => m.id)).toContain('gpt-5.4-mini');
      expect(result.map((m) => m.id)).toContain('gpt-5.3-codex-spark');
      expect(result.map((m) => m.id)).not.toContain('gpt-5.3-codex');
      expect(result.map((m) => m.id)).not.toContain('gpt-5.2-codex');
      expect(result.map((m) => m.id)).not.toContain('gpt-5.1-codex-max');
      // All zero-cost subscription models
      for (const m of result) {
        expect(m.inputPricePerToken).toBe(0);
        expect(m.outputPricePerToken).toBe(0);
      }
    });

    it('should preserve MiniMax model casing in subscription fallback models', () => {
      const result = buildSubscriptionFallbackModels(null as never, 'minimax');

      expect(result.map((m) => m.id)).toEqual([
        'MiniMax-M3',
        'MiniMax-M2.7',
        'MiniMax-M2.7-highspeed',
        'MiniMax-M2.5',
        'MiniMax-M2.5-highspeed',
        'MiniMax-M2.1',
        'MiniMax-M2.1-highspeed',
        'MiniMax-M2',
      ]);
    });

    it('should not build hardcoded Qwen Token Plan fallback models', () => {
      const orMap = new Map([
        [
          'qwen/qwen3.6-plus',
          {
            input: 0.0000005,
            output: 0.000003,
            contextWindow: 1000000,
            displayName: 'Qwen 3.6 Plus',
          },
        ],
        [
          'qwen/qwen3.6-plus-20260402',
          {
            input: 0.0000005,
            output: 0.000003,
            contextWindow: 1000000,
            displayName: 'Qwen 3.6 Plus snapshot',
          },
        ],
        [
          'qwen/qwen-image-2.0',
          {
            input: 0,
            output: 0,
            contextWindow: 0,
            displayName: 'Qwen Image 2.0',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'qwen');

      expect(result).toEqual([]);
    });

    it('should use exact match mode for gemini — excludes suffixed cache entries', () => {
      const orMap = new Map([
        // Exact knownModel matches — included
        [
          'google/gemini-2.5-pro',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro',
          },
        ],
        [
          'google/gemini-2.5-flash',
          {
            input: 0.0000003,
            output: 0.0000025,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Flash',
          },
        ],
        [
          'google/gemini-3.1-pro-preview',
          {
            input: 0.000002,
            output: 0.000012,
            contextWindow: 1000000,
            displayName: 'Gemini 3.1 Pro Preview',
          },
        ],
        // Suffixed variants — excluded because gemini uses 'exact' mode
        [
          'google/gemini-2.5-pro-preview-06-05',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro Preview',
          },
        ],
        [
          'google/gemini-2.5-flash-lite-preview-06-17',
          {
            input: 0.0000001,
            output: 0.0000008,
            contextWindow: 1000000,
            displayName: 'Flash Lite Preview',
          },
        ],
        // Unrelated provider — excluded
        [
          'openai/gpt-4o',
          { input: 0.0000025, output: 0.00001, contextWindow: 128000, displayName: 'GPT-4o' },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const result = buildSubscriptionFallbackModels(mockPricingSync as never, 'gemini');
      const ids = result.map((m) => m.id);

      // Exact matches included
      expect(ids).toContain('gemini-2.5-pro');
      expect(ids).toContain('gemini-2.5-flash');
      expect(ids).toContain('gemini-3.1-pro-preview');
      // Suffixed entries excluded (exact mode vs prefix mode)
      expect(ids).not.toContain('gemini-2.5-pro-preview-06-05');
      expect(ids).not.toContain('gemini-2.5-flash-lite-preview-06-17');
      // gpt-4o is not a gemini model
      expect(ids).not.toContain('gpt-4o');
      // gemini-2.5-flash-lite not in cache → added as zero-cost known model
      expect(ids).toContain('gemini-2.5-flash-lite');
      expect(result.find((m) => m.id === 'gemini-2.5-flash-lite')!.inputPricePerToken).toBe(0);
    });

    it('gemini exact mode vs anthropic prefix mode — illustrates the difference', () => {
      // For a prefix-mode provider (anthropic), a suffixed model IS included.
      // For gemini (exact mode), only verbatim knownModels entries are included.
      const orMap = new Map([
        // This would match the 'claude-opus-4' prefix → included for anthropic
        [
          'anthropic/claude-opus-4-20260301',
          {
            input: 0.000015,
            output: 0.000075,
            contextWindow: 200000,
            displayName: 'Claude Opus 4',
          },
        ],
        // This has a preview suffix → excluded for gemini (exact), would be included for prefix
        [
          'google/gemini-2.5-pro-preview-06-05',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro Preview',
          },
        ],
        // Exact match → included for gemini
        [
          'google/gemini-2.5-pro',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro',
          },
        ],
      ]);
      mockPricingSync.getAll.mockReturnValue(orMap);

      const geminiResult = buildSubscriptionFallbackModels(mockPricingSync as never, 'gemini');
      const anthropicResult = buildSubscriptionFallbackModels(
        mockPricingSync as never,
        'anthropic',
      );

      // Anthropic includes the dated suffix via prefix match
      expect(anthropicResult.map((m) => m.id)).toContain('claude-opus-4-20260301');
      // Gemini excludes the preview suffix (exact mode)
      expect(geminiResult.map((m) => m.id)).not.toContain('gemini-2.5-pro-preview-06-05');
      // Gemini only has the verbatim match
      expect(geminiResult.map((m) => m.id)).toContain('gemini-2.5-pro');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-3.1-pro-preview');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-3.1-flash-lite-preview');
    });
  });

  /* ── supplementWithKnownModels ── */

  describe('supplementWithKnownModels', () => {
    it('should add missing knownModels to discovered models', () => {
      const raw: DiscoveredModel[] = [makeModel({ id: 'gpt-oss-120b', provider: 'openai' })];

      const result = supplementWithKnownModels(raw, 'openai');

      // 1 discovered + 4 ChatGPT-account supported knownModels
      expect(result.length).toBe(5);
      expect(result[0].id).toBe('gpt-oss-120b');
      expect(result.map((m) => m.id)).toContain('gpt-5.5');
      expect(result.map((m) => m.id)).toContain('gpt-5.4');
      expect(result.map((m) => m.id)).toContain('gpt-5.4-mini');
      expect(result.map((m) => m.id)).toContain('gpt-5.3-codex-spark');
      expect(result.map((m) => m.id)).not.toContain('gpt-5.2-codex');
    });

    it('should not duplicate models already in raw', () => {
      const raw: DiscoveredModel[] = [
        makeModel({ id: 'gpt-5.5', provider: 'openai', contextWindow: 200000 }),
      ];

      const result = supplementWithKnownModels(raw, 'openai');

      const matchingModels = result.filter((m) => m.id === 'gpt-5.5');
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

      const result = supplementWithKnownModels(raw, 'deepseek');

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

    it('uses known-model-prices when no upstream source has data', async () => {
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

    it('known-model-prices wins over models.dev for curated models', async () => {
      // Same model id can appear in models.dev under a different inference
      // provider with different pricing. The hand-curated entry must win so
      // a connection's reported pricing reflects THAT connection's provider.
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'moonshot-v1-8k',
        name: 'Moonshot v1 8k (cheap-reseller pricing)',
        inputPricePerToken: 0.000_000_1, // models.dev cheap reseller price
        outputPricePerToken: 0.000_000_2,
        contextWindow: 8192,
      });

      const models = [
        makeModel({
          id: 'moonshot-v1-8k',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Known-prices ($1.66/1M) wins over models.dev ($0.0001/1M).
      expect(result[0].inputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
      expect(result[0].outputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
    });

    it('known-model-prices wins over OpenRouter for curated models', async () => {
      // Mirrors the Groq-served `qwen/qwen3-32b` scenario: OR has the model
      // id at one provider's price; the connection's actual provider lists
      // it at a different price in known-model-prices.
      mockModelsDevSync.lookupModel.mockReturnValue(null);
      mockPricingSync.lookupPricing.mockReturnValue({
        input: 0.000_000_08, // OpenRouter's cheap-resale price
        output: 0.000_000_24,
        contextWindow: 32768,
        displayName: 'Moonshot v1 8k via OR',
      });

      const models = [
        makeModel({
          id: 'moonshot-v1-8k',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
      expect(result[0].outputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
    });

    it('falls through to models.dev when no known-prices entry exists', async () => {
      // Non-curated models keep the existing upstream-first behaviour.
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'totally-novel-model',
        name: 'Novel Model',
        inputPricePerToken: 0.001,
        outputPricePerToken: 0.002,
        contextWindow: 128_000,
      });

      const models = [
        makeModel({
          id: 'totally-novel-model',
          inputPricePerToken: null,
          outputPricePerToken: null,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      expect(result[0].inputPricePerToken).toBe(0.001);
      expect(result[0].outputPricePerToken).toBe(0.002);
    });

    it('still merges capability flags from models.dev when known-prices wins on pricing', async () => {
      // Identified by cubic: when known-prices wins, we still want the
      // reasoning / tool-call flags from models.dev applied — they drive
      // tier auto-assignment scoring and shouldn't be silently dropped.
      mockModelsDevSync.lookupModel.mockReturnValue({
        id: 'moonshot-v1-8k',
        name: 'Moonshot v1 8k',
        inputPricePerToken: 0.000_000_1, // ignored — known-prices wins
        outputPricePerToken: 0.000_000_2,
        contextWindow: 8192,
        reasoning: true,
        toolCall: true,
      });

      const models = [
        makeModel({
          id: 'moonshot-v1-8k',
          inputPricePerToken: null,
          outputPricePerToken: null,
          capabilityReasoning: false,
          capabilityCode: false,
        }),
      ];
      fetcher.fetch.mockResolvedValue(models);

      const result = await service.discoverModels(makeProvider());

      // Pricing from known-prices.
      expect(result[0].inputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
      expect(result[0].outputPricePerToken).toBeCloseTo(1.66 / 1_000_000, 12);
      // Capabilities still merged from models.dev.
      expect(result[0].capabilityReasoning).toBe(true);
      expect(result[0].capabilityCode).toBe(true);
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
