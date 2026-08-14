// IMPORTANT: PublicStatsController uses module-level cache variables (cachedUsage,
// cachedFree, cachedProviderTokens, cachedAgentTokens, cachedFreeProviders) plus the
// matching `*Timestamp` and `*Inflight` lets. These survive between `it()` blocks
// because they live in the module closure, not on the controller instance.
//
// We reset them by calling `jest.resetModules()` in beforeEach() and then
// re-importing the controller via freshImport(). This drops the cached module
// from Jest's module registry so the next `import()` re-evaluates the file with
// all module-level lets back at their initial value (`null` / `0`).
//
// When adding a new describe block: either inherit the parent describe's
// beforeEach (preferred) or, if you override beforeEach, you MUST call
// `jest.resetModules()` and use `freshImport()` to obtain the controller.
// Skipping this leaks cached values across tests and produces nondeterministic
// passes/failures depending on test order.
//
// Future refactor: hoist the caches into an injectable service (e.g. a
// PublicStatsCacheService) so NestJS DI can give each test a fresh instance
// without needing module reimport gymnastics.
import type { ConfigService } from '@nestjs/config';
import type {
  PublicStatsService,
  UsageStats,
  FreeModel,
  ProviderDailyTokens,
  AgentDailyTokens,
} from './public-stats.service';
import type { FreeModelsService } from '../free-models/free-models.service';

const mockService: Record<string, jest.Mock> = {
  getUsageStats: jest.fn(),
  getFreeModels: jest.fn(),
  getProviderDailyTokens: jest.fn(),
  getAgentDailyTokens: jest.fn(),
};

const mockFreeModelsService: Record<string, jest.Mock> = {
  getAll: jest.fn().mockReturnValue({ providers: [], last_synced_at: null }),
};

function makeConfig(enabled: boolean): ConfigService {
  return {
    get: jest.fn((key: string) => (key === 'app.publicStatsEnabled' ? enabled : undefined)),
  } as unknown as ConfigService;
}

jest.mock('./public-stats.service', () => ({
  PublicStatsService: jest.fn().mockImplementation(() => mockService),
}));

const STATS_FIXTURE: UsageStats = {
  total_messages: 100,
  top_models: [
    {
      model: 'gpt-4o',
      provider: 'OpenAI',
      tokens_7d: 5000000,
      tokens_previous_7d: 4500000,
      tokens_30d: 18000000,
      input_price_per_million: 2.5,
      output_price_per_million: 10,
      usage_rank: 1,
    },
  ],
  token_map: new Map([['gpt-4o', 5000000]]),
};

const FREE_FIXTURE: FreeModel[] = [
  { model_name: 'deepseek-chat', provider: 'DeepSeek', tokens_7d: 64000000 },
];

describe('PublicStatsController', () => {
  let controller: InstanceType<typeof import('./public-stats.controller').PublicStatsController>;

  async function freshImport(enabled = true) {
    const mod = await import('./public-stats.controller');
    return new mod.PublicStatsController(
      mockService as unknown as PublicStatsService,
      mockFreeModelsService as unknown as FreeModelsService,
      makeConfig(enabled),
    );
  }

  beforeEach(async () => {
    // Reset module to clear module-level cache state (cachedUsage, cachedFree,
    // cachedProviderTokens, cachedAgentTokens, cachedFreeProviders) plus the
    // matching `*Timestamp` and `*Inflight` lets. Without this, cached values
    // from a previous test would leak into the next one.
    jest.resetModules();
    Object.values(mockService).forEach((m) => m.mockReset());
    controller = await freshImport();
  });

  describe('getUsage', () => {
    it('fetches usage on first call', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(100);
      expect(result.top_models).toHaveLength(1);
      expect(result.cached_at).toBeDefined();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('returns cached within TTL', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      await controller.getUsage();

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      await controller.getUsage();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;

      const updated: UsageStats = { total_messages: 200, top_models: [], token_map: new Map() };
      mockService.getUsageStats.mockResolvedValue(updated);

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(200);
      Date.now = realDateNow;
    });

    it('returns fallback when service fails on first call', async () => {
      mockService.getUsageStats.mockRejectedValue(new Error('fail'));

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
    });

    it('returns stale cache on error after previous success', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      await controller.getUsage();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;
      mockService.getUsageStats.mockRejectedValue(new Error('fail'));

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(100);
      Date.now = realDateNow;
    });
  });

  describe('getFreeModels', () => {
    beforeEach(() => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      mockService.getFreeModels.mockReturnValue(FREE_FIXTURE);
    });

    it('fetches free models on first call', async () => {
      const result = await controller.getFreeModels();

      expect(result.models).toHaveLength(1);
      expect(result.total_models).toBe(1);
      expect(mockService.getFreeModels).toHaveBeenCalledWith(STATS_FIXTURE.token_map);
    });

    it('returns cached within TTL', async () => {
      await controller.getFreeModels();
      const result = await controller.getFreeModels();

      expect(result.models).toHaveLength(1);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('returns fallback when service fails on first call', async () => {
      mockService.getUsageStats.mockRejectedValue(new Error('fail'));

      const result = await controller.getFreeModels();

      expect(result.models).toEqual([]);
      expect(result.total_models).toBe(0);
    });
  });

  describe('getProviderTokens', () => {
    const PROVIDER_FIXTURE: ProviderDailyTokens[] = [
      {
        provider: 'OpenAI',
        total_tokens: 1100000,
        models: [
          {
            model: 'gpt-4o',
            auth_type: 'api_key',
            total_tokens: 1100000,
            total_cost: 1.1,
            daily: [
              { date: '2026-04-06', tokens: 500000 },
              { date: '2026-04-07', tokens: 600000 },
            ],
          },
        ],
        auth_types: [{ auth_type: 'api_key', total_tokens: 1100000, model_count: 1 }],
      },
    ];

    it('fetches provider tokens on first call', async () => {
      mockService.getProviderDailyTokens.mockResolvedValue(PROVIDER_FIXTURE);

      const result = await controller.getProviderTokens();

      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].provider).toBe('OpenAI');
      expect(result.providers[0].auth_types).toEqual([
        { auth_type: 'api_key', total_tokens: 1100000, model_count: 1 },
      ]);
      expect(result.cached_at).toBeDefined();
      expect(mockService.getProviderDailyTokens).toHaveBeenCalledTimes(1);
    });

    it('returns cached within TTL', async () => {
      mockService.getProviderDailyTokens.mockResolvedValue(PROVIDER_FIXTURE);
      await controller.getProviderTokens();

      const result = await controller.getProviderTokens();

      expect(result.providers).toHaveLength(1);
      expect(mockService.getProviderDailyTokens).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      mockService.getProviderDailyTokens.mockResolvedValue(PROVIDER_FIXTURE);
      await controller.getProviderTokens();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;

      const updated: ProviderDailyTokens[] = [];
      mockService.getProviderDailyTokens.mockResolvedValue(updated);

      const result = await controller.getProviderTokens();

      expect(result.providers).toEqual([]);
      Date.now = realDateNow;
    });

    it('returns fallback when service fails on first call', async () => {
      mockService.getProviderDailyTokens.mockRejectedValue(new Error('fail'));

      const result = await controller.getProviderTokens();

      expect(result.providers).toEqual([]);
    });

    it('returns stale cache on error after previous success', async () => {
      mockService.getProviderDailyTokens.mockResolvedValue(PROVIDER_FIXTURE);
      await controller.getProviderTokens();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;
      mockService.getProviderDailyTokens.mockRejectedValue(new Error('fail'));

      const result = await controller.getProviderTokens();

      expect(result.providers).toHaveLength(1);
      Date.now = realDateNow;
    });

    it('deduplicates concurrent requests', async () => {
      let resolve!: (v: ProviderDailyTokens[]) => void;
      mockService.getProviderDailyTokens.mockReturnValue(
        new Promise<ProviderDailyTokens[]>((r) => {
          resolve = r;
        }),
      );

      const p1 = controller.getProviderTokens();
      const p2 = controller.getProviderTokens();

      resolve(PROVIDER_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.providers).toHaveLength(1);
      expect(r2.providers).toHaveLength(1);
      expect(mockService.getProviderDailyTokens).toHaveBeenCalledTimes(1);
    });

    it('clears inflight lock after error', async () => {
      mockService.getProviderDailyTokens.mockRejectedValueOnce(new Error('fail'));
      await controller.getProviderTokens();

      mockService.getProviderDailyTokens.mockResolvedValue(PROVIDER_FIXTURE);
      const result = await controller.getProviderTokens();

      expect(result.providers).toHaveLength(1);
      expect(mockService.getProviderDailyTokens).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAgentTokens', () => {
    const AGENT_FIXTURE: AgentDailyTokens[] = [
      {
        agent_category: 'personal',
        agent_platform: 'openclaw',
        category_label: 'AI agents',
        platform_label: 'OpenClaw',
        total_tokens: 1100000,
        models: [
          {
            model: 'gpt-4o',
            auth_type: 'api_key',
            total_tokens: 1100000,
            total_cost: 1.1,
            daily: [
              { date: '2026-04-06', tokens: 500000 },
              { date: '2026-04-07', tokens: 600000 },
            ],
          },
        ],
      },
    ];

    it('fetches agent tokens on first call', async () => {
      mockService.getAgentDailyTokens.mockResolvedValue(AGENT_FIXTURE);

      const result = await controller.getAgentTokens();

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].agent_category).toBe('personal');
      expect(result.agents[0].agent_platform).toBe('openclaw');
      expect(result.cached_at).toBeDefined();
      expect(mockService.getAgentDailyTokens).toHaveBeenCalledTimes(1);
    });

    it('returns cached within TTL', async () => {
      mockService.getAgentDailyTokens.mockResolvedValue(AGENT_FIXTURE);
      await controller.getAgentTokens();

      const result = await controller.getAgentTokens();

      expect(result.agents).toHaveLength(1);
      expect(mockService.getAgentDailyTokens).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      mockService.getAgentDailyTokens.mockResolvedValue(AGENT_FIXTURE);
      await controller.getAgentTokens();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;

      const updated: AgentDailyTokens[] = [];
      mockService.getAgentDailyTokens.mockResolvedValue(updated);

      const result = await controller.getAgentTokens();

      expect(result.agents).toEqual([]);
      Date.now = realDateNow;
    });

    it('returns fallback when service fails on first call', async () => {
      mockService.getAgentDailyTokens.mockRejectedValue(new Error('fail'));

      const result = await controller.getAgentTokens();

      expect(result.agents).toEqual([]);
    });

    it('returns stale cache on error after previous success', async () => {
      mockService.getAgentDailyTokens.mockResolvedValue(AGENT_FIXTURE);
      await controller.getAgentTokens();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;
      mockService.getAgentDailyTokens.mockRejectedValue(new Error('fail'));

      const result = await controller.getAgentTokens();

      expect(result.agents).toHaveLength(1);
      Date.now = realDateNow;
    });

    it('deduplicates concurrent requests', async () => {
      let resolve!: (v: AgentDailyTokens[]) => void;
      mockService.getAgentDailyTokens.mockReturnValue(
        new Promise<AgentDailyTokens[]>((r) => {
          resolve = r;
        }),
      );

      const p1 = controller.getAgentTokens();
      const p2 = controller.getAgentTokens();

      resolve(AGENT_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.agents).toHaveLength(1);
      expect(r2.agents).toHaveLength(1);
      expect(mockService.getAgentDailyTokens).toHaveBeenCalledTimes(1);
    });

    it('clears inflight lock after error', async () => {
      mockService.getAgentDailyTokens.mockRejectedValueOnce(new Error('fail'));
      await controller.getAgentTokens();

      mockService.getAgentDailyTokens.mockResolvedValue(AGENT_FIXTURE);
      const result = await controller.getAgentTokens();

      expect(result.agents).toHaveLength(1);
      expect(mockService.getAgentDailyTokens).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFreeProviders', () => {
    beforeEach(() => {
      mockFreeModelsService.getAll.mockReset();
    });

    const PROVIDERS_FIXTURE = {
      providers: [
        {
          name: 'Cohere',
          logo: '/icons/cohere.svg',
          description: 'Free trial.',
          tags: ['No credit card required'],
          api_key_url: 'https://cohere.com',
          base_url: 'https://api.cohere.ai/v1',
          warning: null,
          country: 'CA',
          flag: '\u{1F1E8}\u{1F1E6}',
          models: [],
        },
      ],
      last_synced_at: '2026-04-17T00:00:00.000Z',
    };

    it('returns providers on first call', () => {
      mockFreeModelsService.getAll.mockReturnValue(PROVIDERS_FIXTURE);

      const result = controller.getFreeProviders();

      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('Cohere');
      expect(result.last_synced_at).toBe('2026-04-17T00:00:00.000Z');
      expect(result.cached_at).toBeDefined();
    });

    it('returns cached within TTL', () => {
      mockFreeModelsService.getAll.mockReturnValue(PROVIDERS_FIXTURE);
      controller.getFreeProviders();

      const result = controller.getFreeProviders();

      expect(result.providers).toHaveLength(1);
      expect(mockFreeModelsService.getAll).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      const fresh = await freshImport();
      mockFreeModelsService.getAll.mockReturnValue(PROVIDERS_FIXTURE);
      fresh.getFreeProviders();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;

      mockFreeModelsService.getAll.mockReturnValue({ providers: [], last_synced_at: null });

      const result = fresh.getFreeProviders();

      expect(result.providers).toEqual([]);
      Date.now = realDateNow;
    });
  });

  describe('disabled via MANIFEST_PUBLIC_STATS', () => {
    // jest.resetModules() inside freshImport gives this suite a different
    // `NotFoundException` reference than the one imported above, so assert
    // on the HTTP status instead of the class identity.
    function expectNotFound(err: unknown): void {
      expect(err).toBeDefined();
      expect((err as { getStatus?: () => number }).getStatus?.()).toBe(404);
    }

    beforeEach(async () => {
      jest.resetModules();
      mockFreeModelsService.getAll.mockReset();
      controller = await freshImport(false);
    });

    it('returns 404 from getUsage without calling the service', async () => {
      await controller.getUsage().then(
        () => {
          throw new Error('expected NotFoundException');
        },
        (err) => expectNotFound(err),
      );
      expect(mockService.getUsageStats).not.toHaveBeenCalled();
    });

    it('returns 404 from getFreeModels without calling the service', async () => {
      await controller.getFreeModels().then(
        () => {
          throw new Error('expected NotFoundException');
        },
        (err) => expectNotFound(err),
      );
      expect(mockService.getFreeModels).not.toHaveBeenCalled();
    });

    it('returns 404 from getProviderTokens without calling the service', async () => {
      await controller.getProviderTokens().then(
        () => {
          throw new Error('expected NotFoundException');
        },
        (err) => expectNotFound(err),
      );
      expect(mockService.getProviderDailyTokens).not.toHaveBeenCalled();
    });

    it('returns 404 from getAgentTokens without calling the service', async () => {
      await controller.getAgentTokens().then(
        () => {
          throw new Error('expected NotFoundException');
        },
        (err) => expectNotFound(err),
      );
      expect(mockService.getAgentDailyTokens).not.toHaveBeenCalled();
    });

    it('returns 404 from getFreeProviders without calling the service', () => {
      try {
        controller.getFreeProviders();
        throw new Error('expected NotFoundException');
      } catch (err) {
        expectNotFound(err);
      }
      expect(mockFreeModelsService.getAll).not.toHaveBeenCalled();
    });
  });

  describe('stampede prevention', () => {
    it('deduplicates concurrent usage requests', async () => {
      let resolve!: (v: UsageStats) => void;
      mockService.getUsageStats.mockReturnValue(
        new Promise<UsageStats>((r) => {
          resolve = r;
        }),
      );

      const p1 = controller.getUsage();
      const p2 = controller.getUsage();

      resolve(STATS_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.total_messages).toBe(100);
      expect(r2.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('clears inflight lock after error', async () => {
      mockService.getUsageStats.mockRejectedValueOnce(new Error('fail'));
      await controller.getUsage();

      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      const result = await controller.getUsage();

      expect(result.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);
    });
  });

  describe('non-Error rejection handling (branch coverage)', () => {
    it('handles string rejection in usage', async () => {
      mockService.getUsageStats.mockRejectedValue('string error');

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(0);
    });

    it('handles string rejection in free models', async () => {
      mockService.getUsageStats.mockRejectedValue('string error');

      const result = await controller.getFreeModels();

      expect(result.models).toEqual([]);
    });

    it('handles string rejection in provider tokens', async () => {
      mockService.getProviderDailyTokens.mockRejectedValue('string error');

      const result = await controller.getProviderTokens();

      expect(result.providers).toEqual([]);
    });

    it('handles string rejection in agent tokens', async () => {
      mockService.getAgentDailyTokens.mockRejectedValue('string error');

      const result = await controller.getAgentTokens();

      expect(result.agents).toEqual([]);
    });
  });

  describe('regression: response shape', () => {
    it('free-providers response has required fields', () => {
      mockFreeModelsService.getAll.mockReturnValue({
        providers: [
          {
            name: 'TestProvider',
            logo: '/icons/test.svg',
            description: 'A test provider',
            tags: ['free'],
            api_key_url: 'https://example.com/keys',
            base_url: 'https://api.example.com/v1',
            warning: null,
            country: 'US',
            flag: '\u{1F1FA}\u{1F1F8}',
            models: [
              {
                id: 'model-1',
                name: 'Model One',
                context: '128K',
                max_output: '8K',
                modality: 'Text',
                rate_limit: '10 RPM',
              },
            ],
          },
        ],
        last_synced_at: '2026-04-18T00:00:00.000Z',
      });

      const result = controller.getFreeProviders();

      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('last_synced_at');
      expect(result).toHaveProperty('cached_at');
      expect(result.providers[0]).toHaveProperty('name');
      expect(result.providers[0]).toHaveProperty('logo');
      expect(result.providers[0]).toHaveProperty('description');
      expect(result.providers[0]).toHaveProperty('tags');
      expect(result.providers[0]).toHaveProperty('api_key_url');
      expect(result.providers[0]).toHaveProperty('base_url');
      expect(result.providers[0]).toHaveProperty('models');
      expect(result.providers[0].models[0]).toHaveProperty('id');
      expect(result.providers[0].models[0]).toHaveProperty('context');
      expect(result.providers[0].models[0]).toHaveProperty('rate_limit');
    });

    it('usage response has required fields', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);

      const result = await controller.getUsage();

      expect(result).toHaveProperty('total_messages');
      expect(result).toHaveProperty('top_models');
      expect(result).toHaveProperty('cached_at');
      expect(typeof result.cached_at).toBe('string');
    });
  });

  describe('data leak / PII exposure', () => {
    it('free-providers response contains no API keys or secrets', () => {
      mockFreeModelsService.getAll.mockReturnValue({
        providers: [
          {
            name: 'TestProvider',
            logo: '/icons/test.svg',
            description: 'desc',
            tags: [],
            api_key_url: 'https://example.com/keys',
            base_url: 'https://api.example.com/v1',
            warning: null,
            country: 'US',
            flag: '',
            models: [],
          },
        ],
        last_synced_at: null,
      });

      const result = controller.getFreeProviders();
      const json = JSON.stringify(result);

      expect(json).not.toContain('mnfst_');
      expect(json).not.toContain('sk-');
      expect(json).not.toContain('password');
      expect(json).not.toContain('secret');
      expect(json).not.toContain('tenant');
      expect(json).not.toContain('user_id');
      expect(json).not.toContain('email');
    });

    it('free-providers does not expose internal provider IDs or database fields', () => {
      mockFreeModelsService.getAll.mockReturnValue({
        providers: [
          {
            name: 'X',
            logo: null,
            description: '',
            tags: [],
            api_key_url: '',
            base_url: null,
            warning: null,
            country: '',
            flag: '',
            models: [],
          },
        ],
        last_synced_at: null,
      });

      const result = controller.getFreeProviders();
      const provider = result.providers[0];

      expect(provider).not.toHaveProperty('id');
      expect(provider).not.toHaveProperty('tenant_id');
      expect(provider).not.toHaveProperty('created_at');
      expect(provider).not.toHaveProperty('updated_at');
      expect(provider).not.toHaveProperty('api_key');
    });

    it('usage response does not leak user or tenant data', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);

      const result = await controller.getUsage();
      const json = JSON.stringify(result);

      expect(json).not.toContain('tenant');
      expect(json).not.toContain('user_id');
      expect(json).not.toContain('email');
      expect(json).not.toContain('password');
    });
  });

  // Regression: module-level caches MUST be reset between tests. If the
  // beforeEach loses its jest.resetModules() + freshImport() pair, these
  // assertions will fail because state from previous tests would leak in.
  describe('module-level cache isolation (regression)', () => {
    it('cachedUsage starts as null in every test (no leak from sibling tests)', async () => {
      // The parent beforeEach already ran freshImport() and reset mocks.
      // The mock is unconfigured, so the first call hits refreshUsage(),
      // the service throws (no mock return value), and the fallback runs.
      // If the cache leaked, total_messages would be whatever the previous
      // test stored (e.g. 100 from STATS_FIXTURE).
      mockService.getUsageStats.mockRejectedValueOnce(new Error('boom'));

      const result = await controller.getUsage();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
    });

    it('cachedProviderTokens starts as null in every test', async () => {
      mockService.getProviderDailyTokens.mockRejectedValueOnce(new Error('boom'));

      const result = await controller.getProviderTokens();

      expect(result.providers).toEqual([]);
    });

    it('cachedAgentTokens starts as null in every test', async () => {
      mockService.getAgentDailyTokens.mockRejectedValueOnce(new Error('boom'));

      const result = await controller.getAgentTokens();

      expect(result.agents).toEqual([]);
    });

    it('cachedFreeProviders starts as null in every test', () => {
      mockFreeModelsService.getAll.mockReset();
      mockFreeModelsService.getAll.mockReturnValue({ providers: [], last_synced_at: null });

      const result = controller.getFreeProviders();

      // Fresh import means the cache is empty, so the service MUST be called.
      // If the cache leaked, getAll would be skipped and we'd see a stale list.
      expect(mockFreeModelsService.getAll).toHaveBeenCalledTimes(1);
      expect(result.providers).toEqual([]);
    });

    it('freshImport() returns a controller whose getUsage refetches from scratch', async () => {
      // Seed the first controller's cache, then verify a freshly imported
      // controller does NOT see that cached value.
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      const first = await controller.getUsage();
      expect(first.total_messages).toBe(100);

      // freshImport() calls jest.resetModules() implicitly? No — only the
      // parent beforeEach does. So we re-do the dance manually here to prove
      // the pattern.
      jest.resetModules();
      Object.values(mockService).forEach((m) => m.mockReset());
      mockService.getUsageStats.mockRejectedValueOnce(new Error('boom'));
      const fresh = await freshImport();

      const second = await fresh.getUsage();

      // Fresh controller + fresh module = empty cache + failed fetch = fallback.
      expect(second.total_messages).toBe(0);
    });
  });
});
