import { ModelPricesService } from './model-prices.service';

describe('ModelPricesService', () => {
  let service: ModelPricesService;
  let mockQuery: jest.Mock;
  let mockGetUnresolved: jest.Mock;
  let mockGetHistory: jest.Mock;
  let mockSyncPricing: jest.Mock;

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const mockDataSource = { query: mockQuery } as never;
    mockGetUnresolved = jest.fn().mockResolvedValue([]);
    const mockTracker = { getUnresolved: mockGetUnresolved } as never;
    mockGetHistory = jest.fn().mockResolvedValue([]);
    const mockHistory = { getHistory: mockGetHistory } as never;
    mockSyncPricing = jest.fn().mockResolvedValue(0);
    const mockSync = { syncPricing: mockSyncPricing } as never;
    service = new ModelPricesService(mockDataSource, mockTracker, mockHistory, mockSync);
  });

  describe('getAll', () => {
    it('should return transformed models with per-million pricing', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, updated_at: '2025-06-01' },
        ])
        .mockResolvedValueOnce([{ last_synced: '2025-06-01' }]);

      const result = await service.getAll();

      expect(result.models).toEqual([
        { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_million: 2.5, output_price_per_million: 10 },
      ]);
      expect(result.lastSyncedAt).toBe('2025-06-01');
    });

    it('should use "Unknown" when provider is empty', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'test-model', provider: '', input_price_per_token: 0.000001, output_price_per_token: 0.000002, updated_at: null },
        ])
        .mockResolvedValueOnce([{ last_synced: null }]);

      const result = await service.getAll();

      expect(result.models[0].provider).toBe('Unknown');
    });

    it('should return null lastSyncedAt when no updated_at values', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ last_synced: null }]);

      const result = await service.getAll();

      expect(result.models).toEqual([]);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should handle missing last_synced row gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getAll();

      expect(result.lastSyncedAt).toBeNull();
    });

    it('should correctly calculate per-million prices for very small token prices', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'cheap-model', provider: 'Test', input_price_per_token: 0.00000006, output_price_per_token: 0.00000024, updated_at: null },
        ])
        .mockResolvedValueOnce([{ last_synced: null }]);

      const result = await service.getAll();

      expect(result.models[0].input_price_per_million).toBeCloseTo(0.06, 5);
      expect(result.models[0].output_price_per_million).toBeCloseTo(0.24, 5);
    });

    it('should return multiple models sorted by provider', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'claude-opus-4-6', provider: 'Anthropic', input_price_per_token: 0.000015, output_price_per_token: 0.000075, updated_at: '2025-06-01' },
          { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, updated_at: '2025-06-01' },
        ])
        .mockResolvedValueOnce([{ last_synced: '2025-06-01' }]);

      const result = await service.getAll();

      expect(result.models).toHaveLength(2);
      expect(result.models[0].model_name).toBe('claude-opus-4-6');
      expect(result.models[1].model_name).toBe('gpt-4o');
    });
  });

  describe('triggerSync', () => {
    it('should call syncPricing and return the update count', async () => {
      mockSyncPricing.mockResolvedValue(15);

      const result = await service.triggerSync();

      expect(mockSyncPricing).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ updated: 15 });
    });

    it('should return 0 when no models were updated', async () => {
      mockSyncPricing.mockResolvedValue(0);

      const result = await service.triggerSync();

      expect(result).toEqual({ updated: 0 });
    });
  });

  describe('getUnresolved', () => {
    it('should return unresolved models from the tracker', async () => {
      const unresolved = [
        { model_name: 'unknown-model-1', occurrence_count: 5 },
        { model_name: 'unknown-model-2', occurrence_count: 2 },
      ];
      mockGetUnresolved.mockResolvedValue(unresolved);

      const result = await service.getUnresolved();

      expect(result).toEqual(unresolved);
      expect(mockGetUnresolved).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no unresolved models exist', async () => {
      mockGetUnresolved.mockResolvedValue([]);

      const result = await service.getUnresolved();

      expect(result).toEqual([]);
    });
  });

  describe('getHistory', () => {
    it('should return history records with per-million pricing', async () => {
      mockGetHistory.mockResolvedValue([
        {
          model_name: 'gpt-4o',
          input_price_per_token: 0.0000025,
          output_price_per_token: 0.00001,
          changed_at: '2025-06-01',
          source: 'sync',
        },
      ]);

      const result = await service.getHistory('gpt-4o');

      expect(result).toEqual([
        {
          model_name: 'gpt-4o',
          input_price_per_token: 0.0000025,
          output_price_per_token: 0.00001,
          input_price_per_million: 2.5,
          output_price_per_million: 10,
          changed_at: '2025-06-01',
          source: 'sync',
        },
      ]);
      expect(mockGetHistory).toHaveBeenCalledWith('gpt-4o');
    });

    it('should return empty array when no history exists', async () => {
      mockGetHistory.mockResolvedValue([]);

      const result = await service.getHistory('nonexistent-model');

      expect(result).toEqual([]);
    });

    it('should handle multiple history records', async () => {
      mockGetHistory.mockResolvedValue([
        { model_name: 'gpt-4o', input_price_per_token: 0.000003, output_price_per_token: 0.000012, changed_at: '2025-07-01', source: 'sync' },
        { model_name: 'gpt-4o', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, changed_at: '2025-06-01', source: 'sync' },
      ]);

      const result = await service.getHistory('gpt-4o');

      expect(result).toHaveLength(2);
      expect(result[0].input_price_per_million).toBe(3);
      expect(result[1].input_price_per_million).toBe(2.5);
    });
  });
});
