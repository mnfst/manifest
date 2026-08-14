import { ModelPricingCacheService } from './model-pricing-cache.service';
import { PricingSyncService, OpenRouterPricingEntry } from '../database/pricing-sync.service';
import { ModelsDevSyncService } from '../database/models-dev-sync.service';
import { ProviderModelRegistryService } from '../model-discovery/provider-model-registry.service';

/**
 * Tests for the zero-pricing override protection in
 * `ModelPricingCacheService.loadModelsDevEntries()` (see source lines 217-222).
 *
 * Some providers (e.g. GitHub Copilot) ship a models.dev catalog that lists
 * popular third-party models like `gemini-2.5-pro` as $0. Without the guard,
 * those entries would erase the real pricing that came in either from
 * OpenRouter or from an earlier iteration of the models.dev loop. These
 * tests pin the cross-source behavior so the conditional cannot regress
 * silently.
 */

function makeEntry(input: number, output: number): OpenRouterPricingEntry {
  return { input, output };
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
    whenInitialized: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ModelPricingCacheService — zero-pricing override protection', () => {
  let service: ModelPricingCacheService;
  let mockGetAll: jest.Mock;
  let mockRegistry: ReturnType<typeof makeMockRegistry>;
  let mockModelsDevSync: ReturnType<typeof makeMockModelsDevSync>;
  let mockPricingSync: { getAll: jest.Mock; whenInitialized: jest.Mock };

  beforeEach(() => {
    mockGetAll = jest.fn().mockReturnValue(new Map<string, OpenRouterPricingEntry>());
    mockPricingSync = {
      getAll: mockGetAll,
      whenInitialized: jest.fn().mockResolvedValue(undefined),
    };
    mockModelsDevSync = makeMockModelsDevSync();
    mockRegistry = makeMockRegistry();
    service = new ModelPricingCacheService(
      mockPricingSync as unknown as PricingSyncService,
      mockModelsDevSync as unknown as ModelsDevSyncService,
      mockRegistry as unknown as ProviderModelRegistryService,
    );
  });

  describe('OpenRouter real pricing vs models.dev zero pricing', () => {
    it('keeps OpenRouter pricing on the bare key when models.dev lists $0 for the same model', async () => {
      // OpenRouter: real pricing for google/gemini-2.5-pro
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([
          ['google/gemini-2.5-pro', makeEntry(0.001, 0.01)],
        ]),
      );

      // models.dev: GitHub Copilot exposes gemini-2.5-pro as $0 (acts as a
      // proxy — its own pricing for the same model is not relevant).
      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
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

      // The bare key (used by cost lookup on ingested messages that only
      // carry the model name) must still resolve to OpenRouter's real
      // pricing — NOT the $0 entry from copilot's models.dev catalog.
      const bare = service.getByModel('gemini-2.5-pro');
      expect(bare).toBeDefined();
      expect(bare!.source).toBe('openrouter');
      expect(bare!.provider).toBe('Google');
      expect(bare!.input_price_per_token).toBe(0.001);
      expect(bare!.output_price_per_token).toBe(0.01);
    });

    it('lets models.dev override OpenRouter when the new pricing is non-zero', async () => {
      // Inverse case: OpenRouter has zero pricing, models.dev has real
      // pricing. The guard should NOT block this — zero is the bad data,
      // not the good data.
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([['google/gemini-2.5-pro', makeEntry(0, 0)]]),
      );

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
        return [];
      });

      await service.reload();

      const bare = service.getByModel('gemini-2.5-pro');
      expect(bare).toBeDefined();
      expect(bare!.source).toBe('models.dev');
      expect(bare!.provider).toBe('Google');
      expect(bare!.input_price_per_token).toBe(0.00000125);
      expect(bare!.output_price_per_token).toBe(0.00001);
    });

    it('lets models.dev override OpenRouter when both have real pricing', async () => {
      // Sanity: the guard ONLY kicks in for $0 incoming pricing. When
      // models.dev has its own real pricing for a model, it should still
      // win over OpenRouter (curated > broad).
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([
          ['anthropic/claude-opus-4-6', makeEntry(0.000015, 0.000075)],
        ]),
      );

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

      const bare = service.getByModel('claude-opus-4-6');
      expect(bare).toBeDefined();
      expect(bare!.source).toBe('models.dev');
      expect(bare!.input_price_per_token).toBe(0.000005);
    });

    it('treats a single zero side (input=0 but output>0) as NOT zero-pricing', async () => {
      // The guard requires BOTH input and output to be zero for the
      // "isZeroPricing" check. A model with one side non-zero is real
      // pricing and should be allowed to overwrite.
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([
          ['anthropic/claude-half', makeEntry(0.001, 0.002)],
        ]),
      );

      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'anthropic') {
          return [
            {
              id: 'claude-half',
              name: 'Claude Half',
              inputPricePerToken: 0,
              outputPricePerToken: 0.005,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('claude-half');
      expect(entry).toBeDefined();
      // models.dev wins because output is non-zero → not "zero pricing".
      expect(entry!.source).toBe('models.dev');
      expect(entry!.input_price_per_token).toBe(0);
      expect(entry!.output_price_per_token).toBe(0.005);
    });

    it('treats OpenRouter zero-input pricing as NOT "real pricing" so models.dev can win', async () => {
      // hasRealPricing = (existing.input ?? 0) > 0. So if OpenRouter
      // already has input=0 (regardless of output), the guard considers
      // it "no real pricing" and models.dev — even at $0 — overwrites.
      // This pins that boundary so the conditional doesn't drift.
      mockGetAll.mockReturnValue(
        new Map<string, OpenRouterPricingEntry>([
          ['anthropic/claude-free-input', makeEntry(0, 0.002)],
        ]),
      );

      mockModelsDevSync.getModelsForProvider.mockImplementation((providerId: string) => {
        if (providerId === 'anthropic') {
          return [
            {
              id: 'claude-free-input',
              name: 'Claude Free Input',
              inputPricePerToken: 0,
              outputPricePerToken: 0,
            },
          ];
        }
        return [];
      });

      await service.reload();

      const entry = service.getByModel('claude-free-input');
      expect(entry).toBeDefined();
      expect(entry!.source).toBe('models.dev');
      expect(entry!.input_price_per_token).toBe(0);
      expect(entry!.output_price_per_token).toBe(0);
    });
  });
});
