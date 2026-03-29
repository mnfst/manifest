import { ModelsDevSyncService } from './models-dev-sync.service';

let fetchSpy: jest.SpyInstance;

const googleProvider = {
  id: 'google',
  models: {
    'gemini-2.0-flash': {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      reasoning: false,
      cost: { input: 0.1, output: 0.4 },
      limit: { context: 1048576, output: 8192 },
    },
    'gemini-2.5-pro': {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      reasoning: true,
      cost: { input: 1.25, output: 10 },
      limit: { context: 1048576, output: 65536 },
    },
    'gemini-2.5-flash-preview-tts': {
      id: 'gemini-2.5-flash-preview-tts',
      name: 'Gemini 2.5 Flash Preview TTS',
      reasoning: false,
      cost: { input: 0.5, output: 10 },
      limit: { context: 8000, output: 16000 },
    },
  },
};

function mockApiResponse(body: Record<string, unknown>) {
  fetchSpy.mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('ModelsDevSyncService', () => {
  let service: ModelsDevSyncService;

  beforeEach(() => {
    service = new ModelsDevSyncService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('onModuleInit', () => {
    it('calls refreshCache on init', async () => {
      mockApiResponse({ google: googleProvider });

      await service.onModuleInit();
      expect(fetchSpy).toHaveBeenCalledWith('https://models.dev/api.json');
      expect(service.lookupPricing('gemini-2.0-flash')).not.toBeNull();
    });

    it('does not throw when refreshCache rejects', async () => {
      jest.spyOn(service, 'refreshCache').mockRejectedValue(new Error('fail'));
      await service.onModuleInit();
    });
  });

  describe('refreshCache', () => {
    it('populates cache from google provider', async () => {
      mockApiResponse({ google: googleProvider });

      const count = await service.refreshCache();
      expect(count).toBe(3);

      const flash = service.lookupPricing('gemini-2.0-flash');
      expect(flash).not.toBeNull();
      expect(flash!.input).toBeCloseTo(0.1 / 1_000_000);
      expect(flash!.output).toBeCloseTo(0.4 / 1_000_000);
      expect(flash!.displayName).toBe('Gemini 2.0 Flash');
      expect(flash!.contextWindow).toBe(1048576);
      expect(flash!.reasoning).toBe(false);

      const pro = service.lookupPricing('gemini-2.5-pro');
      expect(pro).not.toBeNull();
      expect(pro!.reasoning).toBe(true);
    });

    it('replaces old cache on refresh', async () => {
      mockApiResponse({ google: googleProvider });
      await service.refreshCache();
      expect(service.lookupPricing('gemini-2.0-flash')).not.toBeNull();

      mockApiResponse({
        google: {
          id: 'google',
          models: {
            'gemini-new': {
              id: 'gemini-new',
              name: 'New Model',
              cost: { input: 1, output: 2 },
            },
          },
        },
      });
      await service.refreshCache();
      expect(service.lookupPricing('gemini-2.0-flash')).toBeNull();
      expect(service.lookupPricing('gemini-new')).not.toBeNull();
    });

    it('ignores providers not in SUPPORTED_PROVIDERS', async () => {
      mockApiResponse({
        google: googleProvider,
        openai: {
          id: 'openai',
          models: {
            'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', cost: { input: 2.5, output: 10 } },
          },
        },
      });

      await service.refreshCache();
      expect(service.lookupPricing('gemini-2.0-flash')).not.toBeNull();
      expect(service.lookupPricing('gpt-4o')).toBeNull();
    });

    it('skips models without cost field', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            'no-cost-model': { id: 'no-cost-model', name: 'No Cost' },
            'has-cost': { id: 'has-cost', name: 'Has Cost', cost: { input: 1, output: 2 } },
          },
        },
      });

      const count = await service.refreshCache();
      expect(count).toBe(1);
      expect(service.lookupPricing('no-cost-model')).toBeNull();
      expect(service.lookupPricing('has-cost')).not.toBeNull();
    });

    it('skips models with negative pricing', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            bad: { id: 'bad', name: 'Bad', cost: { input: -1, output: 2 } },
          },
        },
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('skips models with NaN pricing', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            bad: { id: 'bad', name: 'Bad', cost: { input: 'abc', output: 2 } },
          },
        },
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('handles free models with zero pricing', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            'free-model': { id: 'free-model', name: 'Free', cost: { input: 0, output: 0 } },
          },
        },
      });

      const count = await service.refreshCache();
      expect(count).toBe(1);
      const entry = service.lookupPricing('free-model');
      expect(entry!.input).toBe(0);
      expect(entry!.output).toBe(0);
    });

    it('returns 0 when API returns non-OK status', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });
      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('returns 0 when fetch throws', async () => {
      fetchSpy.mockRejectedValue(new Error('network error'));
      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('returns 0 when API returns unexpected format (array)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [1, 2, 3],
      });
      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('returns 0 when API returns null body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => null,
      });
      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('handles provider with no models field', async () => {
      mockApiResponse({ google: { id: 'google' } });
      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('omits displayName when name is missing', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            'no-name': { id: 'no-name', cost: { input: 1, output: 2 } },
          },
        },
      });

      await service.refreshCache();
      const entry = service.lookupPricing('no-name');
      expect(entry!.displayName).toBeUndefined();
    });

    it('omits contextWindow when limit is missing', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            'no-limit': { id: 'no-limit', name: 'Test', cost: { input: 1, output: 2 } },
          },
        },
      });

      await service.refreshCache();
      const entry = service.lookupPricing('no-limit');
      expect(entry!.contextWindow).toBeUndefined();
    });

    it('omits reasoning when not provided', async () => {
      mockApiResponse({
        google: {
          id: 'google',
          models: {
            'no-reasoning': { id: 'no-reasoning', name: 'Test', cost: { input: 1, output: 2 } },
          },
        },
      });

      await service.refreshCache();
      const entry = service.lookupPricing('no-reasoning');
      expect(entry!.reasoning).toBeUndefined();
    });
  });

  describe('lookupPricing', () => {
    it('returns null for unknown model', () => {
      expect(service.lookupPricing('nonexistent')).toBeNull();
    });

    it('returns entry for known model', async () => {
      mockApiResponse({ google: googleProvider });
      await service.refreshCache();

      const entry = service.lookupPricing('gemini-2.5-pro');
      expect(entry).not.toBeNull();
      expect(entry!.displayName).toBe('Gemini 2.5 Pro');
    });

    it('returns null for empty cache', () => {
      expect(service.lookupPricing('gemini-2.0-flash')).toBeNull();
    });
  });
});
