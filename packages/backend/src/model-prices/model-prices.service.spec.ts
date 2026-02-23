import { ModelPricesService } from './model-prices.service';

describe('ModelPricesService', () => {
  let service: ModelPricesService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const mockDataSource = { query: mockQuery } as never;
    service = new ModelPricesService(mockDataSource);
  });

  describe('getAll', () => {
    it('should return transformed models with per-million pricing', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, updated_at: '2025-06-01', capability_vision: true, capability_tool_calling: true, capability_reasoning: false, capability_structured_output: true },
        ])
        .mockResolvedValueOnce([{ last_synced: '2025-06-01' }]);

      const result = await service.getAll();

      expect(result.models).toEqual([
        { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_million: 2.5, output_price_per_million: 10, capability_vision: true, capability_tool_calling: true, capability_reasoning: false, capability_structured_output: true },
      ]);
      expect(result.lastSyncedAt).toBe('2025-06-01');
    });

    it('should use "Unknown" when provider is empty', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'test-model', provider: '', input_price_per_token: 0.000001, output_price_per_token: 0.000002, updated_at: null, capability_vision: false, capability_tool_calling: false, capability_reasoning: false, capability_structured_output: false },
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
          { model_name: 'cheap-model', provider: 'Test', input_price_per_token: 0.00000006, output_price_per_token: 0.00000024, updated_at: null, capability_vision: false, capability_tool_calling: true, capability_reasoning: false, capability_structured_output: false },
        ])
        .mockResolvedValueOnce([{ last_synced: null }]);

      const result = await service.getAll();

      expect(result.models[0].input_price_per_million).toBeCloseTo(0.06, 5);
      expect(result.models[0].output_price_per_million).toBeCloseTo(0.24, 5);
    });

    it('should return multiple models sorted by provider', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { model_name: 'claude-opus-4-6', provider: 'Anthropic', input_price_per_token: 0.000015, output_price_per_token: 0.000075, updated_at: '2025-06-01', capability_vision: true, capability_tool_calling: true, capability_reasoning: true, capability_structured_output: true },
          { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, updated_at: '2025-06-01', capability_vision: true, capability_tool_calling: true, capability_reasoning: false, capability_structured_output: true },
        ])
        .mockResolvedValueOnce([{ last_synced: '2025-06-01' }]);

      const result = await service.getAll();

      expect(result.models).toHaveLength(2);
      expect(result.models[0].model_name).toBe('claude-opus-4-6');
      expect(result.models[1].model_name).toBe('gpt-4o');
    });
  });
});
