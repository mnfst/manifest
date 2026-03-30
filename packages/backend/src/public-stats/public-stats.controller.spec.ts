import type { PublicStatsService, UsageStats, FreeModel } from './public-stats.service';

const mockService: Record<string, jest.Mock> = {
  getUsageStats: jest.fn(),
  getFreeModels: jest.fn(),
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
      input_price_per_million: 2.5,
      output_price_per_million: 10,
      usage_rank: 1,
    },
    {
      model: 'claude-opus-4-6',
      provider: 'Anthropic',
      tokens_7d: 3000000,
      input_price_per_million: 15,
      output_price_per_million: 75,
      usage_rank: 2,
    },
  ],
  token_map: new Map([
    ['gpt-4o', 5000000],
    ['claude-opus-4-6', 3000000],
  ]),
};

const FREE_MODELS_FIXTURE: FreeModel[] = [
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

  // ── getStats ──────────────────────────────────────────────────

  describe('getStats', () => {
    it('fetches stats on first call', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);

      const result = await controller.getStats();

      expect(result.total_messages).toBe(100);
      expect(result.top_models).toHaveLength(2);
      expect(result.top_models[0].provider).toBe('OpenAI');
      expect(result.cached_at).toBeDefined();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('returns cached stats within TTL', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);

      await controller.getStats();
      const result = await controller.getStats();

      expect(result.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      await controller.getStats();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;

      const updated: UsageStats = { total_messages: 200, top_models: [], token_map: new Map() };
      mockService.getUsageStats.mockResolvedValue(updated);

      const result = await controller.getStats();

      expect(result.total_messages).toBe(200);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);

      Date.now = realDateNow;
    });

    it('returns cached_at as valid ISO date string', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      const result = await controller.getStats();
      expect(new Date(result.cached_at).toISOString()).toBe(result.cached_at);
    });

    it('returns fallback when service fails on first call', async () => {
      mockService.getUsageStats.mockRejectedValue(new Error('db error'));

      const result = await controller.getStats();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
      expect(new Date(result.cached_at).toISOString()).toBe(result.cached_at);
    });

    it('returns stale cache when service fails after previous success', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      await controller.getStats();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;
      mockService.getUsageStats.mockRejectedValue(new Error('db error'));

      const result = await controller.getStats();

      expect(result.total_messages).toBe(100);
      Date.now = realDateNow;
    });
  });

  // ── getModelCatalog ───────────────────────────────────────────

  describe('getModelCatalog', () => {
    beforeEach(() => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      mockService.getFreeModels.mockReturnValue(FREE_MODELS_FIXTURE);
    });

    it('fetches free models on first call', async () => {
      const result = await controller.getModelCatalog();

      expect(result.models).toHaveLength(1);
      expect(result.models[0].model_name).toBe('deepseek-chat');
      expect(result.total_models).toBe(1);
      expect(result.cached_at).toBeDefined();
    });

    it('passes token_map to getFreeModels', async () => {
      await controller.getModelCatalog();

      expect(mockService.getFreeModels).toHaveBeenCalledWith(STATS_FIXTURE.token_map);
    });

    it('returns cached catalog within TTL', async () => {
      await controller.getModelCatalog();
      const result = await controller.getModelCatalog();

      expect(result.models).toHaveLength(1);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      await controller.getModelCatalog();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;
      mockService.getFreeModels.mockReturnValue([]);

      const result = await controller.getModelCatalog();

      expect(result.total_models).toBe(0);
      Date.now = realDateNow;
    });

    it('returns fallback when service fails on first call', async () => {
      mockService.getUsageStats.mockRejectedValue(new Error('db error'));

      const result = await controller.getModelCatalog();

      expect(result.models).toEqual([]);
      expect(result.total_models).toBe(0);
    });

    it('returns stale cache when service fails after previous success', async () => {
      await controller.getModelCatalog();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;
      mockService.getUsageStats.mockRejectedValue(new Error('db error'));

      const result = await controller.getModelCatalog();

      expect(result.models).toHaveLength(1);
      Date.now = realDateNow;
    });
  });

  // ── Cache isolation & stampede ────────────────────────────────

  describe('cache isolation', () => {
    it('stats cache and catalog cache are independent', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      mockService.getFreeModels.mockReturnValue(FREE_MODELS_FIXTURE);

      await controller.getStats();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);

      await controller.getModelCatalog();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent stats requests', async () => {
      let resolve!: (v: UsageStats) => void;
      mockService.getUsageStats.mockReturnValue(
        new Promise<UsageStats>((r) => {
          resolve = r;
        }),
      );

      const p1 = controller.getStats();
      const p2 = controller.getStats();

      resolve(STATS_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.total_messages).toBe(100);
      expect(r2.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent catalog requests', async () => {
      let resolve!: (v: UsageStats) => void;
      mockService.getUsageStats.mockReturnValue(
        new Promise<UsageStats>((r) => {
          resolve = r;
        }),
      );
      mockService.getFreeModels.mockReturnValue(FREE_MODELS_FIXTURE);

      const p1 = controller.getModelCatalog();
      const p2 = controller.getModelCatalog();

      resolve(STATS_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.models).toHaveLength(1);
      expect(r2.models).toHaveLength(1);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('clears inflight lock after error so next request retries', async () => {
      mockService.getUsageStats.mockRejectedValueOnce(new Error('fail'));
      await controller.getStats();

      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      const result = await controller.getStats();

      expect(result.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);
    });
  });
});
