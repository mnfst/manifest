import { ModelPricesService } from './model-prices.service';
import { DataSource } from 'typeorm';

describe('ModelPricesService', () => {
  let service: ModelPricesService;
  let mockDs: jest.Mocked<DataSource>;

  beforeEach(() => {
    mockDs = { query: jest.fn() } as unknown as jest.Mocked<DataSource>;
    service = new ModelPricesService(mockDs);
  });

  it('returns mapped models and lastSyncedAt', async () => {
    mockDs.query
      .mockResolvedValueOnce([
        { model_name: 'gpt-4', provider: 'OpenAI', input_price_per_token: 0.00003, output_price_per_token: 0.00006, updated_at: '2024-01-01' },
      ])
      .mockResolvedValueOnce([{ last_synced: '2024-01-01' }]);

    const result = await service.getAll();

    expect(result.models).toEqual([
      { model_name: 'gpt-4', provider: 'OpenAI', input_price_per_million: 30, output_price_per_million: 60 },
    ]);
    expect(result.lastSyncedAt).toBe('2024-01-01');
  });

  it('defaults provider to Unknown when empty', async () => {
    mockDs.query
      .mockResolvedValueOnce([
        { model_name: 'custom-model', provider: '', input_price_per_token: 0.00001, output_price_per_token: 0.00002, updated_at: null },
      ])
      .mockResolvedValueOnce([{ last_synced: null }]);

    const result = await service.getAll();

    expect(result.models[0].provider).toBe('Unknown');
    expect(result.lastSyncedAt).toBeNull();
  });

  it('handles empty model list', async () => {
    mockDs.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}]);

    const result = await service.getAll();

    expect(result.models).toEqual([]);
    expect(result.lastSyncedAt).toBeNull();
  });
});
