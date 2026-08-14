import { FreeModelsService } from './free-models.service';
import { FreeModelsSyncService, GitHubProvider } from './free-models-sync.service';

function makeSyncService(
  providers: GitHubProvider[] = [],
  lastFetchedAt: Date | null = null,
): FreeModelsSyncService {
  return {
    getAll: () => providers,
    getLastFetchedAt: () => lastFetchedAt,
  } as unknown as FreeModelsSyncService;
}

const cohereProvider: GitHubProvider = {
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
};

const unknownProvider: GitHubProvider = {
  name: 'NewProvider',
  category: 'inference_provider',
  country: 'DE',
  flag: '\u{1F1E9}\u{1F1EA}',
  url: 'https://newprovider.com/keys',
  baseUrl: 'https://api.newprovider.com/v1',
  description: 'A new provider.',
  footnoteRef: null,
  models: [
    {
      id: 'model-x',
      name: 'Model X',
      context: '128K',
      maxOutput: '32K',
      modality: 'Text',
      rateLimit: '30 RPM',
    },
  ],
};

const providerWithNullBaseUrl: GitHubProvider = {
  name: 'Ollama Cloud',
  category: 'inference_provider',
  country: 'US',
  flag: '\u{1F1FA}\u{1F1F8}',
  url: 'https://ollama.com/settings/keys',
  baseUrl: null,
  description: 'Free tier.',
  footnoteRef: null,
  models: [
    {
      id: 'llama3.1:cloud',
      name: 'llama3.1',
      context: '128K',
      maxOutput: '8K',
      modality: 'Text',
      rateLimit: '30 RPM',
    },
  ],
};

const providerWithNullModelId: GitHubProvider = {
  name: 'Cohere',
  category: 'provider_api',
  country: 'CA',
  flag: '\u{1F1E8}\u{1F1E6}',
  url: 'https://dashboard.cohere.com/api-keys',
  baseUrl: 'https://api.cohere.ai/compatibility/v1',
  description: 'Free trial.',
  footnoteRef: null,
  models: [
    {
      id: null,
      name: '+ 5 more models',
      context: 'Varies',
      maxOutput: 'Varies',
      modality: 'Text',
      rateLimit: 'Varies',
    },
  ],
};

describe('FreeModelsService', () => {
  describe('getAll', () => {
    it('returns empty providers when sync has no data', () => {
      const service = new FreeModelsService(makeSyncService());
      const result = service.getAll();
      expect(result.providers).toEqual([]);
      expect(result.last_synced_at).toBeNull();
    });

    it('transforms known provider with metadata', () => {
      const now = new Date('2026-04-17T00:00:00Z');
      const service = new FreeModelsService(makeSyncService([cohereProvider], now));
      const result = service.getAll();

      expect(result.providers).toHaveLength(1);
      expect(result.last_synced_at).toBe(now.toISOString());

      const p = result.providers[0];
      expect(p.name).toBe('Cohere');
      expect(p.logo).toBe('/icons/cohere.svg');
      expect(p.description).toBe('Free trial API key.');
      expect(p.tags).toEqual(['Up to 1,000 calls/month', 'No credit card required']);
      expect(p.api_key_url).toBe('https://dashboard.cohere.com/api-keys');
      expect(p.base_url).toBe('https://api.cohere.ai/compatibility/v1');
      expect(p.warning).toContain('Trial keys cannot be used');
      expect(p.country).toBe('CA');
      expect(p.flag).toBe('\u{1F1E8}\u{1F1E6}');

      expect(p.models).toHaveLength(1);
      expect(p.models[0]).toEqual({
        id: 'command-a-03-2025',
        name: 'Command A (111B)',
        context: '256K',
        max_output: '4K',
        modality: 'Text',
        rate_limit: '20 RPM',
      });
    });

    it('handles unknown provider without metadata', () => {
      const service = new FreeModelsService(makeSyncService([unknownProvider]));
      const result = service.getAll();

      const p = result.providers[0];
      expect(p.name).toBe('NewProvider');
      expect(p.logo).toBeNull();
      expect(p.tags).toEqual([]);
      expect(p.warning).toBeNull();
      expect(p.base_url).toBe('https://api.newprovider.com/v1');
    });

    it('handles provider with null baseUrl', () => {
      const service = new FreeModelsService(makeSyncService([providerWithNullBaseUrl]));
      const result = service.getAll();

      expect(result.providers[0].base_url).toBeNull();
    });

    it('handles models with null id', () => {
      const service = new FreeModelsService(makeSyncService([providerWithNullModelId]));
      const result = service.getAll();

      expect(result.providers[0].models[0].id).toBeNull();
      expect(result.providers[0].models[0].name).toBe('+ 5 more models');
    });

    it('transforms multiple providers', () => {
      const service = new FreeModelsService(
        makeSyncService([cohereProvider, unknownProvider, providerWithNullBaseUrl]),
      );
      const result = service.getAll();
      expect(result.providers).toHaveLength(3);
    });
  });
});
