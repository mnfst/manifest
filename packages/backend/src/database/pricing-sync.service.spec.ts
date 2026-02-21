import { PricingSyncService } from './pricing-sync.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

const mockUpsert = jest.fn();
const mockRepo = { upsert: mockUpsert } as never;
const mockReload = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn().mockReturnValue([]);
const mockPricingCache = { reload: mockReload, getAll: mockGetAll } as unknown as ModelPricingCacheService;
const mockModuleRef = { get: jest.fn() } as never;

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PricingSyncService', () => {
  let service: PricingSyncService;

  beforeEach(() => {
    service = new PricingSyncService(mockRepo, mockPricingCache, mockModuleRef);
    jest.clearAllMocks();
    mockGetAll.mockReturnValue([]);
  });

  it('updates known models from OpenRouter response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4', pricing: { prompt: '0.000015', completion: '0.000075' } },
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          { id: 'some/unknown-model', pricing: { prompt: '0.001', completion: '0.002' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(2);
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        model_name: 'claude-opus-4-6',
        provider: 'Anthropic',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
      },
      ['model_name'],
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
      },
      ['model_name'],
    );
  });

  it('returns 0 when API returns non-OK status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('returns 0 when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('skips models with zero pricing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0', completion: '0' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('skips models with missing pricing field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o' }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
  });

  it('handles empty data array', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
  });
});
