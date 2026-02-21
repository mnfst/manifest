import { ModelPricesService } from './model-prices.service';

describe('ModelPricesService', () => {
  let service: ModelPricesService;
  let mockDs: { query: jest.Mock };

  beforeEach(() => {
    mockDs = { query: jest.fn() };
    service = new ModelPricesService(mockDs as never);
  });

  it('returns formatted model prices', async () => {
    mockDs.query
      .mockResolvedValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_token: 0.0000025, output_price_per_token: 0.00001, updated_at: '2025-01-01' },
      ])
      .mockResolvedValueOnce([{ last_synced: '2025-01-01T00:00:00Z' }]);

    const result = await service.getAll();

    expect(result.models).toHaveLength(1);
    expect(result.models[0].model_name).toBe('gpt-4o');
    expect(result.models[0].provider).toBe('OpenAI');
    expect(result.models[0].input_price_per_million).toBe(2.5);
    expect(result.models[0].output_price_per_million).toBe(10);
    expect(result.lastSyncedAt).toBe('2025-01-01T00:00:00Z');
  });

  it('defaults provider to Unknown when empty', async () => {
    mockDs.query
      .mockResolvedValueOnce([
        { model_name: 'custom-model', provider: '', input_price_per_token: 0.001, output_price_per_token: 0.002, updated_at: null },
      ])
      .mockResolvedValueOnce([{ last_synced: null }]);

    const result = await service.getAll();

    expect(result.models[0].provider).toBe('Unknown');
    expect(result.lastSyncedAt).toBeNull();
  });

  it('returns empty array when no models exist', async () => {
    mockDs.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ last_synced: null }]);

    const result = await service.getAll();

    expect(result.models).toHaveLength(0);
    expect(result.lastSyncedAt).toBeNull();
  });
});
