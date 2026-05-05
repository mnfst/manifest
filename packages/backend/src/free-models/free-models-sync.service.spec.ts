import { FreeModelsSyncService } from './free-models-sync.service';

const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/8b0feb0e3adda96455bcc380b815454944ff3832/data.json';

const sampleData = {
  lastUpdated: '2026-04-17',
  providers: [
    {
      name: 'Cohere',
      category: 'provider_api',
      country: 'CA',
      flag: '\u{1F1E8}\u{1F1E6}',
      url: 'https://dashboard.cohere.com/api-keys',
      baseUrl: 'https://api.cohere.ai/compatibility/v1',
      description: 'Free trial API key.',
      footnoteRef: null,
      models: [
        {
          id: 'command-a-03-2025',
          name: 'Command A (111B)',
          context: '256K',
          maxOutput: '4K',
          modality: 'Text',
          rateLimit: '20 RPM',
        },
      ],
    },
    {
      name: 'Google Gemini',
      category: 'provider_api',
      country: 'US',
      flag: '\u{1F1FA}\u{1F1F8}',
      url: 'https://aistudio.google.com/app/apikey',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      description: 'Free tier.',
      footnoteRef: 1,
      models: [
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          context: '1M',
          maxOutput: '65K',
          modality: 'Text + Image',
          rateLimit: '10 RPM',
        },
      ],
    },
  ],
};

let fetchSpy: jest.SpyInstance;

describe('FreeModelsSyncService', () => {
  let service: FreeModelsSyncService;

  beforeEach(() => {
    service = new FreeModelsSyncService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('onModuleInit', () => {
    it('calls refreshCache on init', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => sampleData,
      });

      await service.onModuleInit();
      expect(fetchSpy).toHaveBeenCalledWith(GITHUB_RAW_URL);
      expect(service.getAll()).toHaveLength(2);
    });

    it('does not throw when refreshCache rejects', async () => {
      jest.spyOn(service, 'refreshCache').mockRejectedValue(new Error('Unexpected'));
      await service.onModuleInit();
    });
  });

  describe('refreshCache', () => {
    it('populates cache with successful response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => sampleData,
      });

      const count = await service.refreshCache();
      expect(count).toBe(2);
      expect(service.getAll()).toHaveLength(2);
      expect(service.getAll()[0].name).toBe('Cohere');
      expect(service.getAll()[1].name).toBe('Google Gemini');
      expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
    });

    it('returns 0 when API returns non-OK status', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 503 });

      const count = await service.refreshCache();
      expect(count).toBe(0);
      expect(service.getAll()).toHaveLength(0);
    });

    it('returns 0 when fetch throws', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const count = await service.refreshCache();
      expect(count).toBe(0);
      expect(service.getAll()).toHaveLength(0);
    });

    it('returns 0 when providers array is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ lastUpdated: '2026-04-17' }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('keeps stale cache when fetch fails after previous success', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => sampleData,
      });
      await service.refreshCache();
      expect(service.getAll()).toHaveLength(2);

      fetchSpy.mockRejectedValue(new Error('Network error'));
      const count = await service.refreshCache();
      expect(count).toBe(0);
      // Stale cache preserved
      expect(service.getAll()).toHaveLength(2);
    });

    it('drops entries whose url is not https', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-17',
          providers: [
            { ...sampleData.providers[0], url: 'http://insecure.example/keys' },
            sampleData.providers[1],
          ],
        }),
      });
      const count = await service.refreshCache();
      expect(count).toBe(1);
      expect(service.getAll()[0].name).toBe('Google Gemini');
    });

    it('drops entries whose baseUrl is not https or null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-17',
          providers: [
            { ...sampleData.providers[0], baseUrl: 'http://insecure.example/v1' },
            sampleData.providers[1],
          ],
        }),
      });
      const count = await service.refreshCache();
      expect(count).toBe(1);
    });

    it('keeps entries whose baseUrl is null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-17',
          providers: [{ ...sampleData.providers[0], baseUrl: null }],
        }),
      });
      const count = await service.refreshCache();
      expect(count).toBe(1);
    });

    it('drops entries with non-string name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-17',
          providers: [{ ...sampleData.providers[0], name: 123 }, sampleData.providers[1]],
        }),
      });
      const count = await service.refreshCache();
      expect(count).toBe(1);
      expect(service.getAll()[0].name).toBe('Google Gemini');
    });

    it('drops entries whose models array contains non-objects', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-17',
          providers: [
            { ...sampleData.providers[0], models: ['not-an-object'] },
            sampleData.providers[1],
          ],
        }),
      });
      const count = await service.refreshCache();
      expect(count).toBe(1);
    });

    it('drops null providers without throwing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-17',
          providers: [null, sampleData.providers[1]],
        }),
      });
      const count = await service.refreshCache();
      expect(count).toBe(1);
    });

    it('replaces entire cache on successful refresh', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => sampleData,
      });
      await service.refreshCache();
      expect(service.getAll()).toHaveLength(2);

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          lastUpdated: '2026-04-18',
          providers: [sampleData.providers[0]],
        }),
      });
      await service.refreshCache();
      expect(service.getAll()).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('returns empty array initially', () => {
      expect(service.getAll()).toEqual([]);
    });
  });

  describe('getLastFetchedAt', () => {
    it('returns null before any refresh', () => {
      expect(service.getLastFetchedAt()).toBeNull();
    });

    it('does not update when fetch fails', async () => {
      fetchSpy.mockRejectedValue(new Error('fail'));
      await service.refreshCache();
      expect(service.getLastFetchedAt()).toBeNull();
    });

    it('does not update when API returns non-OK', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });
      await service.refreshCache();
      expect(service.getLastFetchedAt()).toBeNull();
    });
  });
});
