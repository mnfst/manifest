import { ModelPricesService } from './model-prices.service';

describe('ModelPricesService', () => {
  let service: ModelPricesService;
  let mockPricingCache: { getAll: jest.Mock; reload: jest.Mock };
  let mockPricingSync: { getLastFetchedAt: jest.Mock; refreshCache: jest.Mock };

  beforeEach(() => {
    mockPricingCache = {
      getAll: jest.fn().mockReturnValue([]),
      reload: jest.fn().mockResolvedValue(undefined),
    };
    mockPricingSync = {
      getLastFetchedAt: jest.fn().mockReturnValue(null),
      refreshCache: jest.fn().mockResolvedValue(0),
    };
    service = new ModelPricesService(mockPricingCache as never, mockPricingSync as never);
  });

  describe('getAll', () => {
    it('should return transformed models with per-million pricing', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'gpt-4o',
          provider: 'OpenAI',
          input_price_per_token: 0.0000025,
          output_price_per_token: 0.00001,
        },
      ]);
      mockPricingSync.getLastFetchedAt.mockReturnValue(new Date('2025-06-01T00:00:00Z'));

      const result = await service.getAll();

      expect(result.models).toEqual([
        {
          model_name: 'gpt-4o',
          provider: 'OpenAI',
          input_price_per_million: 2.5,
          output_price_per_million: 10,
          display_name: null,
        },
      ]);
      expect(result.lastSyncedAt).toBe('2025-06-01T00:00:00.000Z');
    });

    it('should use "Unknown" when provider is empty', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'test-model',
          provider: '',
          input_price_per_token: 0.000001,
          output_price_per_token: 0.000002,
        },
      ]);

      const result = await service.getAll();

      expect(result.models[0].provider).toBe('Unknown');
      expect(result.models[0].display_name).toBeNull();
    });

    it('should return null lastSyncedAt when getLastFetchedAt returns null', async () => {
      mockPricingCache.getAll.mockReturnValue([]);
      mockPricingSync.getLastFetchedAt.mockReturnValue(null);

      const result = await service.getAll();

      expect(result.models).toEqual([]);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should correctly calculate per-million prices for very small token prices', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'cheap-model',
          provider: 'Test',
          input_price_per_token: 0.00000006,
          output_price_per_token: 0.00000024,
        },
      ]);

      const result = await service.getAll();

      expect(result.models[0].input_price_per_million).toBeCloseTo(0.06, 5);
      expect(result.models[0].output_price_per_million).toBeCloseTo(0.24, 5);
    });

    it('should pass through null prices as null', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'custom-model',
          provider: 'custom:abc',
          input_price_per_token: null,
          output_price_per_token: null,
        },
      ]);

      const result = await service.getAll();

      expect(result.models[0].input_price_per_million).toBeNull();
      expect(result.models[0].output_price_per_million).toBeNull();
    });

    it('should handle mixed null and non-null prices', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'partial-model',
          provider: 'custom:abc',
          input_price_per_token: 0.000001,
          output_price_per_token: null,
        },
      ]);

      const result = await service.getAll();

      expect(result.models[0].input_price_per_million).toBeCloseTo(1.0, 5);
      expect(result.models[0].output_price_per_million).toBeNull();
    });

    it('should return multiple models', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'claude-opus-4-6',
          provider: 'Anthropic',
          input_price_per_token: 0.000015,
          output_price_per_token: 0.000075,
        },
        {
          model_name: 'gpt-4o',
          provider: 'OpenAI',
          input_price_per_token: 0.0000025,
          output_price_per_token: 0.00001,
        },
      ]);
      mockPricingSync.getLastFetchedAt.mockReturnValue(new Date('2025-06-01T00:00:00Z'));

      const result = await service.getAll();

      expect(result.models).toHaveLength(2);
      expect(result.models[0].model_name).toBe('claude-opus-4-6');
      expect(result.models[1].model_name).toBe('gpt-4o');
    });

    it('should pass through validated flag', async () => {
      mockPricingCache.getAll.mockReturnValue([
        {
          model_name: 'gpt-4o',
          provider: 'OpenAI',
          input_price_per_token: 0.0000025,
          output_price_per_token: 0.00001,
          validated: true,
        },
        {
          model_name: 'phantom-model',
          provider: 'Qwen',
          input_price_per_token: 0.001,
          output_price_per_token: 0.002,
          validated: false,
        },
        {
          model_name: 'unknown',
          provider: 'OpenRouter',
          input_price_per_token: 0.001,
          output_price_per_token: 0.002,
        },
      ]);

      const result = await service.getAll();

      expect(result.models[0].validated).toBe(true);
      expect(result.models[1].validated).toBe(false);
      expect(result.models[2].validated).toBeUndefined();
    });
  });

  describe('triggerSync', () => {
    it('should call refreshCache and reload, then return update count', async () => {
      mockPricingSync.refreshCache.mockResolvedValue(15);

      const result = await service.triggerSync();

      expect(mockPricingSync.refreshCache).toHaveBeenCalledTimes(1);
      expect(mockPricingCache.reload).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ updated: 15 });
    });

    it('should return 0 when no models were updated', async () => {
      mockPricingSync.refreshCache.mockResolvedValue(0);

      const result = await service.triggerSync();

      expect(result).toEqual({ updated: 0 });
    });

    it('should reload cache after refreshCache completes', async () => {
      const callOrder: string[] = [];
      mockPricingSync.refreshCache.mockImplementation(async () => {
        callOrder.push('refreshCache');
        return 5;
      });
      mockPricingCache.reload.mockImplementation(async () => {
        callOrder.push('reload');
      });

      await service.triggerSync();

      expect(callOrder).toEqual(['refreshCache', 'reload']);
    });
  });
});
