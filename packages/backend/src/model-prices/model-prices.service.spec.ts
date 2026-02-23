import { ModelPricesService } from './model-prices.service';
import { DataSource } from 'typeorm';
import { UnresolvedModelTrackerService } from './unresolved-model-tracker.service';
import { PricingHistoryService } from '../database/pricing-history.service';
import { PricingSyncService } from '../database/pricing-sync.service';

describe('ModelPricesService', () => {
  let service: ModelPricesService;
  let mockDs: jest.Mocked<DataSource>;
  let mockQuery: jest.Mock;
  let mockTracker: jest.Mocked<UnresolvedModelTrackerService>;
  let mockHistory: jest.Mocked<PricingHistoryService>;
  let mockSync: jest.Mocked<PricingSyncService>;

  beforeEach(() => {
    mockDs = { query: jest.fn() } as unknown as jest.Mocked<DataSource>;
    mockQuery = mockDs.query as jest.Mock;
    mockTracker = {
      getUnresolved: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<UnresolvedModelTrackerService>;
    mockHistory = {
      getHistory: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PricingHistoryService>;
    mockSync = {
      syncPricing: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<PricingSyncService>;
    service = new ModelPricesService(mockDs, mockTracker, mockHistory, mockSync);
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

  it('returns multiple models correctly', async () => {
    mockQuery
      .mockResolvedValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, updated_at: '2025-01-01' },
        { model_name: 'claude-opus-4', provider: 'Anthropic', input_price_per_token: 0.000015, output_price_per_token: 0.000075, updated_at: '2025-01-01' },
      ])
      .mockResolvedValueOnce([{ last_synced: '2025-01-01' }]);

    const result = await service.getAll();

    expect(result.models).toHaveLength(2);
    expect(result.models[0]).toEqual({
      model_name: 'gpt-4o',
      provider: 'OpenAI',
      input_price_per_million: 2.5,
      output_price_per_million: 10,
    });
    expect(result.models[1]).toEqual({
      model_name: 'claude-opus-4',
      provider: 'Anthropic',
      input_price_per_million: 15,
      output_price_per_million: 75,
    });
  });

  it('handles empty model list', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}]);

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
    it('delegates to pricing sync service and returns count', async () => {
      mockSync.syncPricing.mockResolvedValue(150);
      const result = await service.triggerSync();
      expect(result).toEqual({ updated: 150 });
      expect(mockSync.syncPricing).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUnresolved', () => {
    it('delegates to tracker service', async () => {
      const entries = [{ model_name: 'unknown', occurrence_count: 10 }];
      mockTracker.getUnresolved.mockResolvedValue(entries as never);

      const result = await service.getUnresolved();
      expect(result).toEqual(entries);
    });
  });

  describe('getHistory', () => {
    it('converts prices to per-million format', async () => {
      mockHistory.getHistory.mockResolvedValue([
        {
          id: '1',
          model_name: 'gpt-4o',
          input_price_per_token: 0.0000025 as never,
          output_price_per_token: 0.00001 as never,
          provider: 'OpenAI',
          effective_from: new Date('2025-01-01'),
          effective_until: null,
          change_source: 'sync',
        },
      ]);

      const result = await service.getHistory('gpt-4o');

      expect(result[0].input_price_per_million).toBeCloseTo(2.5);
      expect(result[0].output_price_per_million).toBeCloseTo(10);
    });

    it('preserves all original fields alongside computed ones', async () => {
      const effectiveFrom = new Date('2025-01-01');
      const effectiveUntil = new Date('2025-06-01');
      mockHistory.getHistory.mockResolvedValue([
        {
          id: 'uuid-123',
          model_name: 'gpt-4o',
          input_price_per_token: 0.000003 as never,
          output_price_per_token: 0.000012 as never,
          provider: 'OpenAI',
          effective_from: effectiveFrom,
          effective_until: effectiveUntil,
          change_source: 'manual',
        },
      ]);

      const result = await service.getHistory('gpt-4o');

      expect(result[0].id).toBe('uuid-123');
      expect(result[0].model_name).toBe('gpt-4o');
      expect(result[0].provider).toBe('OpenAI');
      expect(result[0].effective_from).toBe(effectiveFrom);
      expect(result[0].effective_until).toBe(effectiveUntil);
      expect(result[0].change_source).toBe('manual');
    });

    it('handles string-typed decimal values from DB', async () => {
      mockHistory.getHistory.mockResolvedValue([
        {
          id: '1',
          model_name: 'gpt-4o',
          input_price_per_token: '0.0000025000' as never,
          output_price_per_token: '0.0000100000' as never,
          provider: 'OpenAI',
          effective_from: new Date('2025-01-01'),
          effective_until: null,
          change_source: 'sync',
        },
      ]);

      const result = await service.getHistory('gpt-4o');

      expect(result[0].input_price_per_million).toBeCloseTo(2.5);
      expect(result[0].output_price_per_million).toBeCloseTo(10);
    });

    it('converts multiple history records', async () => {
      mockHistory.getHistory.mockResolvedValue([
        {
          id: '2',
          model_name: 'gpt-4o',
          input_price_per_token: 0.000005 as never,
          output_price_per_token: 0.000015 as never,
          provider: 'OpenAI',
          effective_from: new Date('2025-06-01'),
          effective_until: null,
          change_source: 'sync',
        },
        {
          id: '1',
          model_name: 'gpt-4o',
          input_price_per_token: 0.0000025 as never,
          output_price_per_token: 0.00001 as never,
          provider: 'OpenAI',
          effective_from: new Date('2025-01-01'),
          effective_until: new Date('2025-06-01'),
          change_source: 'sync',
        },
      ]);

      const result = await service.getHistory('gpt-4o');

      expect(result).toHaveLength(2);
      expect(result[0].input_price_per_million).toBeCloseTo(5);
      expect(result[1].input_price_per_million).toBeCloseTo(2.5);
    });

    it('returns empty array for unknown model', async () => {
      mockHistory.getHistory.mockResolvedValue([]);
      const result = await service.getHistory('unknown');
      expect(result).toEqual([]);
    });
  });
});
