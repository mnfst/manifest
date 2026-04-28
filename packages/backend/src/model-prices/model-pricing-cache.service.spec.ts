import { Repository } from 'typeorm';
import { ModelPricingCacheService } from './model-pricing-cache.service';
import { PricingSyncService, OpenRouterPricingEntry } from '../database/pricing-sync.service';
import { ModelsDevSyncService } from '../database/models-dev-sync.service';
import { ProviderModelRegistryService } from '../model-discovery/provider-model-registry.service';
import { CustomProvider } from '../entities/custom-provider.entity';

function makeEntry(input: number, output: number): OpenRouterPricingEntry {
  return { input, output };
}

function makeCustomProviderRepo(rows: CustomProvider[] | Error) {
  const find = jest.fn();
  if (rows instanceof Error) {
    find.mockRejectedValue(rows);
  } else {
    find.mockResolvedValue(rows);
  }
  return { find } as unknown as Repository<CustomProvider>;
}

function makeMockRegistry() {
  return {
    isModelConfirmed: jest.fn().mockReturnValue(null),
    getConfirmedModels: jest.fn().mockReturnValue(null),
    registerModels: jest.fn(),
  };
}

function makeMockModelsDevSync() {
  return {
    lookupModel: jest.fn().mockReturnValue(null),
    getModelsForProvider: jest.fn().mockReturnValue([]),
    isProviderSupported: jest.fn().mockReturnValue(false),
  };
}

describe('ModelPricingCacheService', () => {
  let service: ModelPricingCacheService;
  let mockGetAll: jest.Mock;
  let mockRegistry: ReturnType<typeof makeMockRegistry>;
  let mockModelsDevSync: ReturnType<typeof makeMockModelsDevSync>;

  beforeEach(() => {
    mockGetAll = jest.fn().mockReturnValue(new Map<string, OpenRouterPricingEntry>());
    const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
    mockModelsDevSync = makeMockModelsDevSync();
    mockRegistry = makeMockRegistry();
    service = new ModelPricingCacheService(
      mockSync,
      mockModelsDevSync as unknown as ModelsDevSyncService,
      mockRegistry as unknown as ProviderModelRegistryService,
    );
  });

  describe('onApplicationBootstrap', () => {
    it('should call reload()', async () => {
      const spy = jest.spyOn(service, 'reload').mockResolvedValue();
      await service.onApplicationBootstrap();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduledReload', () => {
    it('should call reload()', async () => {
      const spy = jest.spyOn(service, 'reload').mockResolvedValue();
      await service.scheduledReload();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('reload', () => {
    it('should attribute supported providers from OpenRouter data', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.0000025, 0.00001)],
        ['anthropic/claude-opus-4-6', makeEntry(0.000015, 0.000075)],
        ['google/gemini-2.5-pro', makeEntry(0.000003, 0.000015)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      expect(service.getByModel('openai/gpt-4o')!.provider).toBe('OpenAI');
      expect(service.getByModel('anthropic/claude-opus-4-6')!.provider).toBe('Anthropic');
      expect(service.getByModel('google/gemini-2.5-pro')!.provider).toBe('Google');
    });

    it('should keep unsupported vendors under OpenRouter', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['nousresearch/hermes-3-llama-3.1-405b', makeEntry(0.001, 0.002)],
        ['sao10k/l3-euryale-70b', makeEntry(0.001, 0.002)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      expect(service.getByModel('nousresearch/hermes-3-llama-3.1-405b')!.provider).toBe(
        'OpenRouter',
      );
      expect(service.getByModel('sao10k/l3-euryale-70b')!.provider).toBe('OpenRouter');
    });

    it('should store canonical alias for supported providers', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.0000025, 0.00001)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      // Both full ID and canonical should resolve
      const byFull = service.getByModel('openai/gpt-4o');
      const byCanonical = service.getByModel('gpt-4o');
      expect(byFull).toBeDefined();
      expect(byCanonical).toBeDefined();
      expect(byFull!.provider).toBe('OpenAI');
      expect(byCanonical!.provider).toBe('OpenAI');
    });

    it('should keep openrouter/ prefixed models under OpenRouter', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openrouter/auto', makeEntry(0.000003, 0.000015)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      expect(service.getByModel('openrouter/auto')!.provider).toBe('OpenRouter');
    });

    it('should handle model with no slash prefix', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['some-model', makeEntry(0.001, 0.002)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const entry = service.getByModel('some-model');
      expect(entry).toBeDefined();
      expect(entry!.provider).toBe('OpenRouter');
      expect(entry!.model_name).toBe('some-model');
    });

    it('should return empty when no OpenRouter data available', async () => {
      mockGetAll.mockReturnValue(new Map());
      await service.reload();

      expect(service.getAll()).toEqual([]);
      expect(service.getByModel('glm-5')).toBeUndefined();
    });

    it('should clear old entries and load new ones', async () => {
      mockGetAll.mockReturnValue(new Map([['anthropic/old-model', makeEntry(0.01, 0.02)]]));
      await service.reload();
      expect(service.getByModel('anthropic/old-model')).toBeDefined();

      mockGetAll.mockReturnValue(new Map([['openai/new-model', makeEntry(0.03, 0.04)]]));
      await service.reload();
      expect(service.getByModel('anthropic/old-model')).toBeUndefined();
      expect(service.getByModel('openai/new-model')).toBeDefined();
    });
  });

  describe('getByModel', () => {
    it('should resolve known aliases', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      // "claude-opus-4" is a known alias for "claude-opus-4-6"
      const result = service.getByModel('claude-opus-4');
      expect(result).toBeDefined();
      expect(result!.provider).toBe('Anthropic');
    });

    it('should return undefined for unknown model', async () => {
      mockGetAll.mockReturnValue(new Map());
      await service.reload();
      expect(service.getByModel('totally-unknown')).toBeUndefined();
    });

    it('should resolve dot-variant via normalization', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('claude-opus-4.6');
      expect(result).toBeDefined();
      expect(result!.provider).toBe('Anthropic');
    });

    it('should resolve dash-variant when cached Anthropic model uses dots', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4.6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('claude-opus-4-6');
      expect(result).toBeDefined();
      expect(result!.provider).toBe('Anthropic');
      expect(result!.model_name).toBe('anthropic/claude-opus-4.6');
    });

    it('should resolve date-suffixed model names', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4.1', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('gpt-4.1-2025-04-14');
      expect(result).toBeDefined();
    });

    it('should return undefined before initialization', () => {
      expect(service.getByModel('any-model')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all cached entries', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getAll();
      expect(result.length).toBe(2);
      const names = result.map((e) => e.model_name);
      expect(names).toContain('openai/gpt-4o');
      expect(names).toContain('anthropic/claude-opus-4-6');
    });

    it('should return empty array before initialization', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return a new array each time', async () => {
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.01, 0.02)]]));
      await service.reload();
      const a = service.getAll();
      const b = service.getAll();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('validated flag', () => {
    it('should set validated=true for confirmed models', async () => {
      mockRegistry.isModelConfirmed.mockImplementation((providerId: string, modelId: string) => {
        if (providerId === 'openai' && modelId === 'gpt-4o') return true;
        return null;
      });
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.01, 0.02)]]));
      await service.reload();

      const entry = service.getByModel('openai/gpt-4o');
      expect(entry!.validated).toBe(true);
    });

    it('should set validated=false for unconfirmed models', async () => {
      mockRegistry.isModelConfirmed.mockReturnValue(false);
      mockGetAll.mockReturnValue(new Map([['qwen/phantom-model', makeEntry(0.01, 0.02)]]));
      await service.reload();

      const entry = service.getByModel('qwen/phantom-model');
      expect(entry!.validated).toBe(false);
    });

    it('should set validated=undefined when registry has no data for provider', async () => {
      mockRegistry.isModelConfirmed.mockReturnValue(null);
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.01, 0.02)]]));
      await service.reload();

      const entry = service.getByModel('openai/gpt-4o');
      expect(entry!.validated).toBeUndefined();
    });

    it('should set validated=undefined for unsupported vendors (no providerId)', async () => {
      mockGetAll.mockReturnValue(new Map([['nousresearch/hermes-3', makeEntry(0.01, 0.02)]]));
      await service.reload();

      const entry = service.getByModel('nousresearch/hermes-3');
      expect(entry!.validated).toBeUndefined();
      expect(mockRegistry.isModelConfirmed).not.toHaveBeenCalled();
    });

    it('should work without registry (null)', async () => {
      const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
      const serviceNoRegistry = new ModelPricingCacheService(mockSync, null, null);
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.01, 0.02)]]));
      await serviceNoRegistry.reload();

      const entry = serviceNoRegistry.getByModel('openai/gpt-4o');
      expect(entry!.validated).toBeUndefined();
    });

    it('should propagate validated to canonical alias', async () => {
      mockRegistry.isModelConfirmed.mockReturnValue(true);
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.01, 0.02)]]));
      await service.reload();

      const canonical = service.getByModel('gpt-4o');
      expect(canonical!.validated).toBe(true);
    });

    it('should resolve aliased provider prefix to canonical ID for validation', async () => {
      // "google" is the OpenRouter prefix, but the registry stores under "gemini"
      mockRegistry.isModelConfirmed.mockImplementation((providerId: string, modelId: string) => {
        if (providerId === 'gemini' && modelId === 'gemini-2.5-pro') return true;
        return null;
      });
      mockGetAll.mockReturnValue(new Map([['google/gemini-2.5-pro', makeEntry(0.003, 0.015)]]));
      await service.reload();

      const entry = service.getByModel('google/gemini-2.5-pro');
      expect(entry!.validated).toBe(true);
      expect(mockRegistry.isModelConfirmed).toHaveBeenCalledWith('gemini', 'gemini-2.5-pro');
    });
  });

  describe('models.dev overlay', () => {
    it('should override OpenRouter entries with models.dev data', async () => {
      // OpenRouter has slightly different pricing
      mockGetAll.mockReturnValue(
        new Map([['anthropic/claude-opus-4-6', makeEntry(0.000015, 0.000075)]]),
      );
      // models.dev has correct native-ID pricing
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'anthropic') {
          return [
            {
              id: 'claude-opus-4-6',
              name: 'Claude Opus 4.6',
              inputPricePerToken: 0.000005,
              outputPricePerToken: 0.000025,
            },
          ];
        }
        return [];
      });

      await service.reload();

      // Bare model name should resolve to models.dev data
      const entry = service.getByModel('claude-opus-4-6');
      expect(entry).toBeDefined();
      expect(entry!.source).toBe('models.dev');
      expect(entry!.input_price_per_token).toBe(0.000005);
      expect(entry!.provider).toBe('Anthropic');
    });

    it('should set source to openrouter for non-overlaid entries', async () => {
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.0025, 0.01)]]));
      mockModelsDevSync.getModelsForProvider.mockReturnValue([]);

      await service.reload();

      const entry = service.getByModel('openai/gpt-4o');
      expect(entry!.source).toBe('openrouter');
    });

    it('should skip models.dev entries without pricing', async () => {
      mockGetAll.mockReturnValue(new Map([['deepseek/deepseek-chat', makeEntry(0.001, 0.002)]]));
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'deepseek') {
          return [
            {
              id: 'deepseek-chat',
              name: 'DeepSeek Chat',
              inputPricePerToken: null,
              outputPricePerToken: null,
            },
          ];
        }
        return [];
      });

      await service.reload();

      // OpenRouter entry should remain since models.dev has null pricing
      const entry = service.getByModel('deepseek-chat');
      expect(entry!.source).toBe('openrouter');
    });

    it('should work when modelsDevSync is null', async () => {
      const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
      const serviceNoModelsDev = new ModelPricingCacheService(
        mockSync,
        null,
        mockRegistry as unknown as ProviderModelRegistryService,
      );
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.01, 0.02)]]));

      await serviceNoModelsDev.reload();

      expect(serviceNoModelsDev.getByModel('openai/gpt-4o')).toBeDefined();
    });

    it('should set display_name from models.dev entries', async () => {
      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'openai') {
          return [
            {
              id: 'gpt-4o',
              name: 'GPT-4o Enhanced',
              inputPricePerToken: 0.0000025,
              outputPricePerToken: 0.00001,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('gpt-4o');
      expect(entry).toBeDefined();
      expect(entry!.display_name).toBe('GPT-4o Enhanced');
      expect(entry!.source).toBe('models.dev');
    });

    it('should set display_name to null when models.dev entry has no name', async () => {
      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'anthropic') {
          return [
            {
              id: 'claude-test',
              name: '',
              inputPricePerToken: 0.001,
              outputPricePerToken: 0.002,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('claude-test');
      expect(entry).toBeDefined();
      expect(entry!.display_name).toBeNull();
    });

    it('should use resolveValidatedForModelsDev for models.dev entries', async () => {
      mockRegistry.isModelConfirmed.mockImplementation((providerId: string, modelId: string) => {
        if (providerId === 'openai' && modelId === 'gpt-4o') return true;
        return null;
      });

      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'openai') {
          return [
            {
              id: 'gpt-4o',
              name: 'GPT-4o',
              inputPricePerToken: 0.0000025,
              outputPricePerToken: 0.00001,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('gpt-4o');
      expect(entry).toBeDefined();
      expect(entry!.validated).toBe(true);
      expect(mockRegistry.isModelConfirmed).toHaveBeenCalledWith('openai', 'gpt-4o');
    });

    it('should handle models.dev overlay for multiple providers', async () => {
      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'openai') {
          return [
            { id: 'gpt-4o', name: 'GPT-4o', inputPricePerToken: 0.001, outputPricePerToken: 0.002 },
          ];
        }
        if (providerId === 'anthropic') {
          return [
            {
              id: 'claude-opus-4-6',
              name: 'Claude Opus',
              inputPricePerToken: 0.005,
              outputPricePerToken: 0.025,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const openai = service.getByModel('gpt-4o');
      const anthropic = service.getByModel('claude-opus-4-6');
      expect(openai).toBeDefined();
      expect(openai!.provider).toBe('OpenAI');
      expect(anthropic).toBeDefined();
      expect(anthropic!.provider).toBe('Anthropic');
    });

    it('should not log overlay message when no models.dev entries have pricing', async () => {
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.0025, 0.01)]]));
      mockModelsDevSync.getModelsForProvider.mockReturnValue([
        { id: 'no-price', name: 'No Price', inputPricePerToken: null, outputPricePerToken: null },
      ]);

      await service.reload();

      // The entry should be OpenRouter-sourced since models.dev had null pricing
      const entry = service.getByModel('gpt-4o');
      expect(entry!.source).toBe('openrouter');
    });
  });

  describe('resolveValidatedForModelsDev', () => {
    it('should return undefined when registry is null', async () => {
      const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
      const serviceNoRegistry = new ModelPricingCacheService(
        mockSync,
        mockModelsDevSync as unknown as ModelsDevSyncService,
        null,
      );

      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'openai') {
          return [
            { id: 'gpt-4o', name: 'GPT-4o', inputPricePerToken: 0.001, outputPricePerToken: 0.002 },
          ];
        }
        return [];
      });

      await serviceNoRegistry.reload();

      const entry = serviceNoRegistry.getByModel('gpt-4o');
      expect(entry).toBeDefined();
      expect(entry!.validated).toBeUndefined();
    });

    it('should not overwrite real pricing with zero-pricing entry from later provider', async () => {
      // Gemini provider sets gemini-2.5-pro with real pricing,
      // then Copilot provider tries to overwrite with $0 pricing.
      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'gemini') {
          return [
            {
              id: 'gemini-2.5-pro',
              name: 'Gemini 2.5 Pro',
              inputPricePerToken: 0.00000125,
              outputPricePerToken: 0.00001,
            },
          ];
        }
        if (providerId === 'copilot') {
          return [
            {
              id: 'gemini-2.5-pro',
              name: 'Gemini 2.5 Pro',
              inputPricePerToken: 0,
              outputPricePerToken: 0,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('gemini-2.5-pro');
      expect(entry).toBeDefined();
      expect(entry!.provider).toBe('Google');
      expect(entry!.input_price_per_token).toBe(0.00000125);
    });

    it('should allow zero-pricing entry when no existing entry', async () => {
      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'copilot') {
          return [
            {
              id: 'copilot-only-model',
              name: 'Copilot Model',
              inputPricePerToken: 0,
              outputPricePerToken: 0,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('copilot-only-model');
      expect(entry).toBeDefined();
      expect(entry!.provider).toBe('GitHub Copilot');
      expect(entry!.input_price_per_token).toBe(0);
    });

    it('should resolve false for unconfirmed models.dev entries', async () => {
      mockRegistry.isModelConfirmed.mockReturnValue(false);

      mockGetAll.mockReturnValue(new Map());
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'anthropic') {
          return [
            {
              id: 'claude-test',
              name: 'Test',
              inputPricePerToken: 0.001,
              outputPricePerToken: 0.002,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('claude-test');
      expect(entry).toBeDefined();
      expect(entry!.validated).toBe(false);
    });
  });

  describe('custom provider entries', () => {
    const makeCp = (overrides: Partial<CustomProvider> = {}): CustomProvider =>
      ({
        id: 'cp-uuid-1',
        agent_id: 'agent-1',
        user_id: 'user-1',
        name: 'CPA',
        base_url: 'https://example.com/v1',
        models: [],
        created_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
      }) as CustomProvider;

    function makeServiceWithCustom(rows: CustomProvider[] | Error) {
      const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
      return new ModelPricingCacheService(
        mockSync,
        mockModelsDevSync as unknown as ModelsDevSyncService,
        mockRegistry as unknown as ProviderModelRegistryService,
        makeCustomProviderRepo(rows),
      );
    }

    it('indexes prices under the `custom:<uuid>/<model>` key used by the proxy', async () => {
      mockGetAll.mockReturnValue(new Map());
      const svc = makeServiceWithCustom([
        makeCp({
          models: [
            {
              model_name: 'gemini-3-flash',
              input_price_per_million_tokens: 2,
              output_price_per_million_tokens: 6,
            },
          ],
        }),
      ]);

      await svc.reload();

      const entry = svc.getByModel('custom:cp-uuid-1/gemini-3-flash');
      expect(entry).toBeDefined();
      // Per-million input/output → per-token (divide by 1e6).
      expect(entry!.input_price_per_token).toBe(2 / 1_000_000);
      expect(entry!.output_price_per_token).toBe(6 / 1_000_000);
      expect(entry!.provider).toBe('Custom');
      expect(entry!.source).toBe('custom');
    });

    it('excludes custom entries from getAll() to avoid leaking across tenants', async () => {
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([['openai/gpt-4o', makeEntry(0.001, 0.002)]]),
      );
      const svc = makeServiceWithCustom([
        makeCp({
          models: [
            {
              model_name: 'private-model',
              input_price_per_million_tokens: 1,
              output_price_per_million_tokens: 1,
            },
          ],
        }),
      ]);

      await svc.reload();

      // The custom model must still be resolvable by getByModel (the UUID
      // makes the key globally unique), but must NOT appear in getAll()
      // since /api/v1/model-prices is not scoped by user.
      expect(svc.getByModel('custom:cp-uuid-1/private-model')).toBeDefined();
      const all = svc.getAll();
      expect(all.some((e) => e.model_name.startsWith('custom:'))).toBe(false);
      expect(all.some((e) => e.model_name === 'openai/gpt-4o')).toBe(true);
    });

    it('handles models with only input or only output pricing set', async () => {
      mockGetAll.mockReturnValue(new Map());
      const svc = makeServiceWithCustom([
        makeCp({
          models: [
            { model_name: 'input-only', input_price_per_million_tokens: 5 },
            { model_name: 'output-only', output_price_per_million_tokens: 10 },
          ],
        }),
      ]);

      await svc.reload();

      const inputOnly = svc.getByModel('custom:cp-uuid-1/input-only');
      expect(inputOnly!.input_price_per_token).toBe(5 / 1_000_000);
      expect(inputOnly!.output_price_per_token).toBeNull();

      const outputOnly = svc.getByModel('custom:cp-uuid-1/output-only');
      expect(outputOnly!.input_price_per_token).toBeNull();
      expect(outputOnly!.output_price_per_token).toBe(10 / 1_000_000);
    });

    it('skips entries with no pricing at all (nothing to compute)', async () => {
      mockGetAll.mockReturnValue(new Map());
      const svc = makeServiceWithCustom([
        makeCp({
          models: [{ model_name: 'no-price' }],
        }),
      ]);

      await svc.reload();

      expect(svc.getByModel('custom:cp-uuid-1/no-price')).toBeUndefined();
    });

    it('skips rows with a missing/empty models array without crashing', async () => {
      mockGetAll.mockReturnValue(new Map());
      const svc = makeServiceWithCustom([
        makeCp({ models: undefined as unknown as CustomProvider['models'] }),
        makeCp({ id: 'cp-uuid-2', models: [] }),
      ]);

      await expect(svc.reload()).resolves.toBeUndefined();
      expect(svc.getAll()).toEqual([]);
    });

    it('skips rows whose model_name is empty (no valid cache key)', async () => {
      mockGetAll.mockReturnValue(new Map());
      const svc = makeServiceWithCustom([
        makeCp({
          models: [
            {
              model_name: '',
              input_price_per_million_tokens: 1,
              output_price_per_million_tokens: 2,
            },
          ],
        }),
      ]);

      await svc.reload();
      // No entry keyed on an empty model name should end up in the cache.
      expect(svc.getAll()).toEqual([]);
    });

    it('degrades gracefully when the custom provider repo read fails', async () => {
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([['openai/gpt-4o', makeEntry(0.001, 0.002)]]),
      );
      const svc = makeServiceWithCustom(new Error('db down'));

      await expect(svc.reload()).resolves.toBeUndefined();
      // OpenRouter entries must still be present even if custom load fails.
      expect(svc.getByModel('openai/gpt-4o')).toBeDefined();
    });

    it('works when no custom provider repo is injected (legacy wiring)', async () => {
      const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
      const svc = new ModelPricingCacheService(
        mockSync,
        mockModelsDevSync as unknown as ModelsDevSyncService,
        mockRegistry as unknown as ProviderModelRegistryService,
      );
      mockGetAll.mockReturnValue(new Map([['openai/gpt-4o', makeEntry(0.001, 0.002)]]));

      await expect(svc.reload()).resolves.toBeUndefined();
      expect(svc.getByModel('openai/gpt-4o')).toBeDefined();
    });

    it('drops stale custom entries on reload when rows are removed', async () => {
      mockGetAll.mockReturnValue(new Map());
      // Mutable rows array so we can simulate a removal between reloads.
      const rows: CustomProvider[] = [
        makeCp({
          models: [
            {
              model_name: 'gemini-3-flash',
              input_price_per_million_tokens: 2,
              output_price_per_million_tokens: 6,
            },
          ],
        }),
      ];
      const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
      const repo = {
        find: jest.fn().mockImplementation(() => Promise.resolve(rows)),
      } as unknown as Repository<CustomProvider>;
      const svc = new ModelPricingCacheService(
        mockSync,
        mockModelsDevSync as unknown as ModelsDevSyncService,
        mockRegistry as unknown as ProviderModelRegistryService,
        repo,
      );

      await svc.reload();
      expect(svc.getByModel('custom:cp-uuid-1/gemini-3-flash')).toBeDefined();

      // Simulate provider deletion → repo now returns an empty list.
      rows.length = 0;
      await svc.reload();
      expect(svc.getByModel('custom:cp-uuid-1/gemini-3-flash')).toBeUndefined();
    });
  });
});
