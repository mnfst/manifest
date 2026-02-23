import { PricingSyncService } from './pricing-sync.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingHistoryService } from './pricing-history.service';
import { UnresolvedModelTrackerService } from '../model-prices/unresolved-model-tracker.service';

const mockUpsert = jest.fn();
const mockFindOneBy = jest.fn().mockResolvedValue(null);
const mockRepo = { upsert: mockUpsert, findOneBy: mockFindOneBy } as never;
const mockReload = jest.fn().mockResolvedValue(undefined);
const mockPricingCache = { reload: mockReload } as unknown as ModelPricingCacheService;
const mockRecordChange = jest.fn().mockResolvedValue(false);
const mockPricingHistory = { recordChange: mockRecordChange } as unknown as PricingHistoryService;
const mockGetUnresolved = jest.fn().mockResolvedValue([]);
const mockMarkResolved = jest.fn().mockResolvedValue(undefined);
const mockUnresolvedTracker = {
  getUnresolved: mockGetUnresolved,
  markResolved: mockMarkResolved,
} as unknown as UnresolvedModelTrackerService;

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PricingSyncService', () => {
  let service: PricingSyncService;

  beforeEach(() => {
    service = new PricingSyncService(
      mockRepo,
      mockPricingCache,
      mockPricingHistory,
      mockUnresolvedTracker,
    );
    jest.clearAllMocks();
    mockFindOneBy.mockResolvedValue(null);
    mockRecordChange.mockResolvedValue(false);
    mockGetUnresolved.mockResolvedValue([]);
  });

  it('updates all models with pricing from OpenRouter', async () => {
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

    expect(updated).toBe(3);
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'claude-opus-4',
        provider: 'Anthropic',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
      }),
      ['model_name'],
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
      }),
      ['model_name'],
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'unknown-model',
        provider: 'Some',
      }),
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

  it('does not call reload when zero models are updated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0', completion: '0' } }],
      }),
    });

    await service.syncPricing();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles missing data field in response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('handles models with only prompt pricing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input_price_per_token: 0.0000025,
        output_price_per_token: 0,
      }),
      ['model_name'],
    );
  });

  it('handles models with only completion pricing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { completion: '0.00001' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input_price_per_token: 0,
        output_price_per_token: 0.00001,
      }),
      ['model_name'],
    );
  });

  it('passes existing model to recordChange when found in DB', async () => {
    const existingModel = {
      model_name: 'gpt-4o',
      input_price_per_token: 0.000002,
      output_price_per_token: 0.00001,
      provider: 'OpenAI',
    };
    mockFindOneBy.mockResolvedValue(existingModel);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();

    expect(mockRecordChange).toHaveBeenCalledWith(
      existingModel,
      expect.objectContaining({ model_name: 'gpt-4o' }),
      'sync',
    );
  });

  it('records price history for each model', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();

    expect(mockRecordChange).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        model_name: 'gpt-4o',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
      }),
      'sync',
    );
  });

  it('includes updated_at in upsert', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: expect.any(Date) }),
      ['model_name'],
    );
  });

  describe('deriveNames', () => {
    it('derives canonical name and known provider', () => {
      expect(service.deriveNames('anthropic/claude-opus-4')).toEqual({
        canonical: 'claude-opus-4',
        provider: 'Anthropic',
      });
    });

    it('derives canonical name for unknown provider', () => {
      expect(service.deriveNames('newprovider/some-model')).toEqual({
        canonical: 'some-model',
        provider: 'Newprovider',
      });
    });

    it('handles IDs without slash', () => {
      expect(service.deriveNames('standalone-model')).toEqual({
        canonical: 'standalone-model',
        provider: 'Unknown',
      });
    });

    it('maps meta-llama to Meta', () => {
      expect(service.deriveNames('meta-llama/llama-4-scout').provider).toBe('Meta');
    });

    it('maps qwen to Alibaba', () => {
      expect(service.deriveNames('qwen/qwen3-235b-a22b').provider).toBe('Alibaba');
    });

    it('maps xai to xAI', () => {
      expect(service.deriveNames('xai/grok-3').provider).toBe('xAI');
    });

    it('maps google to Google', () => {
      expect(service.deriveNames('google/gemini-2.0-flash').provider).toBe('Google');
    });

    it('maps deepseek to DeepSeek', () => {
      expect(service.deriveNames('deepseek/deepseek-v3').provider).toBe('DeepSeek');
    });

    it('maps mistralai to Mistral', () => {
      expect(service.deriveNames('mistralai/mistral-large').provider).toBe('Mistral');
    });

    it('maps cohere to Cohere', () => {
      expect(service.deriveNames('cohere/command-r-plus').provider).toBe('Cohere');
    });

    it('maps amazon to Amazon', () => {
      expect(service.deriveNames('amazon/nova-pro').provider).toBe('Amazon');
    });

    it('maps moonshotai to Moonshot', () => {
      expect(service.deriveNames('moonshotai/moonshot-v1').provider).toBe('Moonshot');
    });

    it('maps zhipuai to Zhipu', () => {
      expect(service.deriveNames('zhipuai/glm-4-plus').provider).toBe('Zhipu');
    });

    it('handles multi-segment canonical names after slash', () => {
      expect(service.deriveNames('openai/gpt-4o-mini-2024-07-18')).toEqual({
        canonical: 'gpt-4o-mini-2024-07-18',
        provider: 'OpenAI',
      });
    });
  });

  describe('auto-resolve unresolved models', () => {
    it('resolves models that match synced names', async () => {
      mockGetUnresolved.mockResolvedValue([
        { model_name: 'gpt-4o', resolved: false },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          ],
        }),
      });

      await service.syncPricing();

      expect(mockMarkResolved).toHaveBeenCalledWith('gpt-4o', 'gpt-4o');
    });

    it('resolves prefixed model names', async () => {
      mockGetUnresolved.mockResolvedValue([
        { model_name: 'openai/gpt-4o', resolved: false },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          ],
        }),
      });

      await service.syncPricing();

      expect(mockMarkResolved).toHaveBeenCalledWith('openai/gpt-4o', 'gpt-4o');
    });

    it('resolves date-suffixed model names', async () => {
      mockGetUnresolved.mockResolvedValue([
        { model_name: 'gpt-4o-2025-01-15', resolved: false },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          ],
        }),
      });

      await service.syncPricing();

      expect(mockMarkResolved).toHaveBeenCalledWith('gpt-4o-2025-01-15', 'gpt-4o');
    });

    it('skips resolution when no unresolved models exist', async () => {
      mockGetUnresolved.mockResolvedValue([]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          ],
        }),
      });

      await service.syncPricing();

      expect(mockMarkResolved).not.toHaveBeenCalled();
    });

    it('does not resolve models with no match', async () => {
      mockGetUnresolved.mockResolvedValue([
        { model_name: 'totally-fake', resolved: false },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          ],
        }),
      });

      await service.syncPricing();

      expect(mockMarkResolved).not.toHaveBeenCalled();
    });
  });
});
