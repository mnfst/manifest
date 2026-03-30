import type { PublicStatsService, UsageStats, CatalogModel } from './public-stats.service';

const mockService: Record<string, jest.Mock> = {
  getUsageStats: jest.fn(),
  getModelCatalog: jest.fn(),
  buildRankMap: jest.fn(),
};

jest.mock('./public-stats.service', () => ({
  PublicStatsService: jest.fn().mockImplementation(() => mockService),
}));

const STATS_FIXTURE: UsageStats = {
  total_messages: 100,
  top_models: [
    { model: 'gpt-4o', usage_count: 60 },
    { model: 'claude-opus-4-6', usage_count: 40 },
  ],
};

const CATALOG_FIXTURE: CatalogModel[] = [
  {
    model_name: 'gpt-4o',
    provider: 'OpenAI',
    display_name: 'GPT-4o',
    context_window: 128000,
    input_price_per_million: 2.5,
    output_price_per_million: 10,
    is_free: false,
    usage_rank: 1,
  },
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

      const updated: UsageStats = { total_messages: 200, top_models: [] };
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

    it('returns fallback with valid cached_at when service fails on first call', async () => {
      mockService.getUsageStats.mockRejectedValue(new Error('db error'));

      const result = await controller.getStats();

      expect(result.total_messages).toBe(0);
      expect(result.top_models).toEqual([]);
      expect(new Date(result.cached_at).toISOString()).toBe(result.cached_at);
    });

    it('re-fetches exactly at TTL boundary', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      await controller.getStats();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_000;

      const updated: UsageStats = { total_messages: 999, top_models: [] };
      mockService.getUsageStats.mockResolvedValue(updated);

      const result = await controller.getStats();

      expect(result.total_messages).toBe(999);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);

      Date.now = realDateNow;
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
      mockService.buildRankMap.mockReturnValue(new Map([['gpt-4o', 1]]));
      mockService.getModelCatalog.mockReturnValue(CATALOG_FIXTURE);
    });

    it('fetches catalog on first call', async () => {
      const result = await controller.getModelCatalog();

      expect(result.models).toHaveLength(1);
      expect(result.total_models).toBe(1);
      expect(result.cached_at).toBeDefined();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
      expect(mockService.getModelCatalog).toHaveBeenCalledTimes(1);
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

      mockService.getModelCatalog.mockReturnValue([]);

      const result = await controller.getModelCatalog();

      expect(result.total_models).toBe(0);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);

      Date.now = realDateNow;
    });

    it('returns cached_at as valid ISO date string', async () => {
      const result = await controller.getModelCatalog();

      expect(new Date(result.cached_at).toISOString()).toBe(result.cached_at);
    });

    it('returns fallback with valid cached_at when service fails on first call', async () => {
      mockService.getUsageStats.mockRejectedValue(new Error('db error'));

      const result = await controller.getModelCatalog();

      expect(result.models).toEqual([]);
      expect(result.total_models).toBe(0);
      expect(new Date(result.cached_at).toISOString()).toBe(result.cached_at);
    });

    it('re-fetches exactly at TTL boundary', async () => {
      await controller.getModelCatalog();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_000;

      mockService.getModelCatalog.mockReturnValue([]);

      const result = await controller.getModelCatalog();

      expect(result.total_models).toBe(0);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);

      Date.now = realDateNow;
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

    it('passes rank map to getModelCatalog', async () => {
      const rankMap = new Map([['gpt-4o', 1]]);
      mockService.buildRankMap.mockReturnValue(rankMap);

      await controller.getModelCatalog();

      expect(mockService.buildRankMap).toHaveBeenCalledWith(STATS_FIXTURE.top_models);
      expect(mockService.getModelCatalog).toHaveBeenCalledWith(rankMap);
    });
  });

  // ── Cache isolation ─────────────────────────────────────────────

  describe('cache isolation', () => {
    it('stats cache and catalog cache are independent', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      mockService.buildRankMap.mockReturnValue(new Map());
      mockService.getModelCatalog.mockReturnValue(CATALOG_FIXTURE);

      await controller.getStats();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);

      await controller.getModelCatalog();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent stats requests (stampede prevention)', async () => {
      let resolveInflight!: (v: UsageStats) => void;
      mockService.getUsageStats.mockReturnValue(
        new Promise<UsageStats>((r) => {
          resolveInflight = r;
        }),
      );

      const p1 = controller.getStats();
      const p2 = controller.getStats();

      resolveInflight(STATS_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.total_messages).toBe(100);
      expect(r2.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent catalog requests (stampede prevention)', async () => {
      let resolveInflight!: (v: UsageStats) => void;
      mockService.getUsageStats.mockReturnValue(
        new Promise<UsageStats>((r) => {
          resolveInflight = r;
        }),
      );
      mockService.buildRankMap.mockReturnValue(new Map());
      mockService.getModelCatalog.mockReturnValue(CATALOG_FIXTURE);

      const p1 = controller.getModelCatalog();
      const p2 = controller.getModelCatalog();

      resolveInflight(STATS_FIXTURE);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.models).toHaveLength(1);
      expect(r2.models).toHaveLength(1);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);
    });

    it('clears inflight lock after error so next request retries', async () => {
      mockService.getUsageStats.mockRejectedValueOnce(new Error('fail'));

      await controller.getStats();
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(1);

      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      const result = await controller.getStats();

      expect(result.total_messages).toBe(100);
      expect(mockService.getUsageStats).toHaveBeenCalledTimes(2);
    });

    it('expired stats cache does not affect catalog cache', async () => {
      mockService.getUsageStats.mockResolvedValue(STATS_FIXTURE);
      mockService.buildRankMap.mockReturnValue(new Map());
      mockService.getModelCatalog.mockReturnValue(CATALOG_FIXTURE);

      await controller.getStats();
      await controller.getModelCatalog();

      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 86_400_001;

      const updated: UsageStats = { total_messages: 500, top_models: [] };
      mockService.getUsageStats.mockResolvedValue(updated);

      const statsResult = await controller.getStats();
      expect(statsResult.total_messages).toBe(500);

      const catalogResult = await controller.getModelCatalog();
      expect(catalogResult.models).toHaveLength(1);
      expect(mockService.getModelCatalog).toHaveBeenCalledTimes(2);

      Date.now = realDateNow;
    });
  });
});
