import { PricingSyncService } from './pricing-sync.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingHistoryService } from './pricing-history.service';
import { UnresolvedModelTrackerService } from '../model-prices/unresolved-model-tracker.service';

const mockFindOneBy = jest.fn().mockResolvedValue(null);
const mockUpsert = jest.fn().mockResolvedValue(undefined);
const mockCount = jest.fn().mockResolvedValue(0);
const mockRepo = {
  findOneBy: mockFindOneBy,
  upsert: mockUpsert,
  count: mockCount,
} as never;

const mockReload = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn().mockReturnValue([]);
const mockPricingCache = {
  reload: mockReload,
  getAll: mockGetAll,
} as unknown as ModelPricingCacheService;

const mockRecordChange = jest.fn().mockResolvedValue(false);
const mockPricingHistory = {
  recordChange: mockRecordChange,
} as unknown as PricingHistoryService;

const mockGetUnresolved = jest.fn().mockResolvedValue([]);
const mockMarkResolved = jest.fn().mockResolvedValue(undefined);
const mockUnresolvedTracker = {
  getUnresolved: mockGetUnresolved,
  markResolved: mockMarkResolved,
} as unknown as UnresolvedModelTrackerService;

const mockModuleRefGet = jest.fn();
const mockModuleRef = { get: mockModuleRefGet } as never;

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
      mockModuleRef,
    );
    jest.clearAllMocks();
    mockFindOneBy.mockResolvedValue(null);
    mockGetAll.mockReturnValue([]);
    mockGetUnresolved.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('creates only OpenRouter copies for new models not in seeder', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4', pricing: { prompt: '0.000015', completion: '0.000075' } },
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(2);
    // No canonical entries for new models — only 2 OpenRouter copies
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockRecordChange).toHaveBeenCalledTimes(2);
  });

  it('updates pricing but preserves provider for existing models', async () => {
    const existing = {
      model_name: 'gpt-4o',
      provider: 'OpenAI',
      input_price_per_token: 0.000001,
    };
    mockFindOneBy.mockResolvedValue(existing);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert should NOT include provider
    const canonicalCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'gpt-4o',
    );
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    expect(canonicalCall![0]).toMatchObject({
      model_name: 'gpt-4o',
      input_price_per_token: 0.0000025,
      output_price_per_token: 0.00001,
    });
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

  it('handles response body with undefined data field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('reloads cache when models were updated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('does not reload cache when no models were updated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0', completion: '0' } },
        ],
      }),
    });

    await service.syncPricing();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('calls pricingHistory.recordChange for each model', async () => {
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
        provider: 'OpenAI',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
      }),
      'sync',
    );
    // Only OpenRouter copy (canonical skipped for new models)
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('passes existing model to recordChange when found', async () => {
    const existing = { model_name: 'gpt-4o', input_price_per_token: 0.000001 };
    mockFindOneBy.mockResolvedValue(existing);

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
      existing,
      expect.any(Object),
      'sync',
    );
  });

  it('detects removed models and calls invalidateOverridesForRemovedModels', async () => {
    mockGetAll
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'old-model', provider: 'OpenAI' },
      ])
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
      ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    const mockInvalidate = jest.fn().mockResolvedValue(undefined);
    mockModuleRefGet.mockReturnValue({
      invalidateOverridesForRemovedModels: mockInvalidate,
    });

    await service.syncPricing();
    expect(mockInvalidate).toHaveBeenCalledWith(['old-model']);
  });

  it('logs error when invalidation fails after model removal', async () => {
    mockGetAll
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'removed', provider: 'OpenAI' },
      ])
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
      ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    mockModuleRefGet.mockImplementation(() => {
      throw new Error('Module not found');
    });

    // Should not throw — error is caught internally
    const updated = await service.syncPricing();
    expect(updated).toBe(1);
  });

  it('resolves unresolved models after sync', async () => {
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

  it('does not resolve models that are not in OpenRouter data', async () => {
    mockGetUnresolved.mockResolvedValue([
      { model_name: 'nonexistent-model', resolved: false },
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

  describe('onModuleInit', () => {
    it('skips sync when data is fresh', async () => {
      mockCount.mockResolvedValue(5);
      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('runs sync when data is stale', async () => {
      mockCount.mockResolvedValue(0);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'anthropic/claude-opus-4', pricing: { prompt: '0.000015', completion: '0.000075' } },
          ],
        }),
      });

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
      );
    });

    it('does not crash if startup sync fails', async () => {
      mockCount.mockResolvedValue(0);
      mockFetch.mockRejectedValue(new Error('Startup network error'));

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('deriveNames', () => {
    it('maps known providers correctly', () => {
      expect(service.deriveNames('anthropic/claude-opus-4')).toEqual({
        canonical: 'claude-opus-4',
        provider: 'Anthropic',
      });
      expect(service.deriveNames('openai/gpt-4o')).toEqual({
        canonical: 'gpt-4o',
        provider: 'OpenAI',
      });
      expect(service.deriveNames('google/gemini-2.5-pro')).toEqual({
        canonical: 'gemini-2.5-pro',
        provider: 'Google',
      });
    });

    it('title-cases unknown providers', () => {
      expect(service.deriveNames('newvendor/some-model')).toEqual({
        canonical: 'some-model',
        provider: 'Newvendor',
      });
    });

    it('handles model IDs without slash', () => {
      expect(service.deriveNames('bare-model')).toEqual({
        canonical: 'bare-model',
        provider: 'Unknown',
      });
    });

    it('preserves full ID for openrouter/ models', () => {
      expect(service.deriveNames('openrouter/auto')).toEqual({
        canonical: 'openrouter/auto',
        provider: 'OpenRouter',
      });
    });
  });

  it('maps Zhipu provider correctly', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'glm-4-plus', provider: 'Zhipu' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'zhipuai/glm-4-plus', pricing: { prompt: '0.0000005', completion: '0.0000005' } },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert preserves existing provider (no provider field)
    const canonicalCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'glm-4-plus',
    );
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    // Also stores OpenRouter copy
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'zhipuai/glm-4-plus',
        provider: 'OpenRouter',
      }),
      ['model_name'],
    );
  });

  it('maps Amazon provider correctly', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'nova-pro', provider: 'Amazon' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'amazon/nova-pro', pricing: { prompt: '0.0000008', completion: '0.0000032' } },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert preserves existing provider (no provider field)
    const canonicalCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'nova-pro',
    );
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    // Also stores OpenRouter copy
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'amazon/nova-pro',
        provider: 'OpenRouter',
      }),
      ['model_name'],
    );
  });

  it('skips openrouter/auto entirely when not in seeder', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openrouter/auto', pricing: { prompt: '0.000003', completion: '0.000015' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    // Not in seeder and no vendor prefix → no upserts
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('updates openrouter/auto pricing when already seeded', async () => {
    mockFindOneBy.mockResolvedValue({
      model_name: 'openrouter/auto',
      provider: 'OpenRouter',
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openrouter/auto', pricing: { prompt: '0.000003', completion: '0.000015' } },
        ],
      }),
    });

    await service.syncPricing();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'openrouter/auto',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000015,
      }),
      ['model_name'],
    );
    // Provider is preserved (not included in upsert)
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('provider');
  });

  it('stores context_length as context_window when present (new model)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', context_length: 128000, pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();
    // New model — only OpenRouter copy (canonical skipped)
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'openai/gpt-4o',
        provider: 'OpenRouter',
        context_window: 128000,
      }),
      ['model_name'],
    );
  });

  it('stores context_length as context_window for existing models', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', context_length: 128000, pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert includes context_window
    const canonicalCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'gpt-4o',
    );
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).toMatchObject({
      context_window: 128000,
    });
    expect(canonicalCall![0]).not.toHaveProperty('provider');
  });

  it('omits context_window when context_length is missing (uses DB default)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    await service.syncPricing();
    // No upsert call should include context_window
    for (const call of mockUpsert.mock.calls) {
      expect(call[0]).not.toHaveProperty('context_window');
    }
  });

  it('stores OpenRouter copy with full vendor-prefixed ID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4', pricing: { prompt: '0.000015', completion: '0.000075' } },
        ],
      }),
    });

    await service.syncPricing();
    // New model — only OpenRouter copy (no canonical entry)
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'anthropic/claude-opus-4',
        provider: 'OpenRouter',
        input_price_per_token: 0.000015,
        output_price_per_token: 0.000075,
      }),
      ['model_name'],
    );
  });

  it('logs warning when OpenRouter copy upsert fails', async () => {
    mockFindOneBy.mockResolvedValue({
      model_name: 'claude-opus-4',
      provider: 'Anthropic',
    });
    mockUpsert
      .mockResolvedValueOnce(undefined) // canonical upsert succeeds
      .mockRejectedValueOnce(new Error('unique constraint violated')); // OpenRouter copy fails

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4', pricing: { prompt: '0.000015', completion: '0.000075' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    // Model still counts as updated (canonical upsert succeeded)
    expect(updated).toBe(1);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it('skips bare models (no slash) when not in seeder', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'bare-model', pricing: { prompt: '0.000001', completion: '0.000001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    // Not in seeder, no vendor prefix → no upserts
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('skips models with negative pricing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openrouter/bodybuilder', pricing: { prompt: '-1', completion: '-1' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('maps Qwen/Alibaba provider correctly', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'qwen3-235b-a22b', provider: 'Alibaba' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'qwen/qwen3-235b-a22b', pricing: { prompt: '0.0000003', completion: '0.0000012' } },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert preserves existing provider (no provider field)
    const canonicalCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'qwen3-235b-a22b',
    );
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    // Also stores OpenRouter copy
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_name: 'qwen/qwen3-235b-a22b',
        provider: 'OpenRouter',
      }),
      ['model_name'],
    );
  });
});
