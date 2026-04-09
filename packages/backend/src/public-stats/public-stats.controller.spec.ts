import type {
  PublicStatsService,
  UsageStats,
  FreeModel,
  ProviderDailyTokens,
} from './public-stats.service';

const mockService: Record<string, jest.Mock> = {
  getUsageStats: jest.fn(),
  getFreeModels: jest.fn(),
  getProviderDailyTokens: jest.fn(),
};

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

  async function freshImport() {
    const mod = await import('./public-stats.controller');
    return new mod.PublicStatsController(mockService as unknown as PublicStatsService);
  }

  beforeEach(async () => {
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
            total_tokens: 1100000,
            daily: [
              { date: '2026-04-06', tokens: 500000 },
              { date: '2026-04-07', tokens: 600000 },
            ],
          },
        ],
      },
    ];

    it('fetches provider tokens on first call', async () => {
      mockService.getProviderDailyTokens.mockResolvedValue(PROVIDER_FIXTURE);

      const result = await controller.getProviderTokens();

      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].provider).toBe('OpenAI');
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
});
