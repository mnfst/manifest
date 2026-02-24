import { PricingSyncService } from './pricing-sync.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

const mockUpdate = jest.fn();
const mockRepo = { update: mockUpdate } as never;
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

  it('only updates existing models, skips new ones', async () => {
    // Cache has gpt-4o but not the other two
    mockGetAll.mockReturnValue([
      { model_name: 'gpt-4o', provider: 'OpenAI' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4', context_length: 200000, pricing: { prompt: '0.000015', completion: '0.000075' } },
          { id: 'openai/gpt-4o', context_length: 128000, pricing: { prompt: '0.0000025', completion: '0.00001' } },
          { id: 'x-ai/grok-3', context_length: 131072, pricing: { prompt: '0.000003', completion: '0.000015' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { model_name: 'gpt-4o' },
      expect.objectContaining({
        provider: 'OpenAI',
      }),
    );
  });

  it('skips models from unsupported providers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'meta-llama/llama-4-scout', pricing: { prompt: '0.00000015', completion: '0.00000044' } },
          { id: 'cohere/command-r', pricing: { prompt: '0.00000015', completion: '0.0000006' } },
          { id: 'some/unknown-model', pricing: { prompt: '0.001', completion: '0.002' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips :free, :extended, and :nitro variant suffixes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4:free', pricing: { prompt: '0', completion: '0' } },
          { id: 'openai/gpt-4o:extended', pricing: { prompt: '0.0000025', completion: '0.00001' } },
          { id: 'google/gemini-2.5-pro:nitro', pricing: { prompt: '0.00000125', completion: '0.00001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
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
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('propagates context_length to context_window for existing models', async () => {
    mockGetAll.mockReturnValue([
      { model_name: 'gemini-2.5-pro', provider: 'Google' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'google/gemini-2.5-pro', context_length: 1048576, pricing: { prompt: '0.00000125', completion: '0.00001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { model_name: 'gemini-2.5-pro' },
      expect.objectContaining({
        provider: 'Google',
        context_window: 1048576,
      }),
    );
  });

  it('updates only prices for existing models (preserves quality_score and capabilities)', async () => {
    // Simulate existing models in cache
    mockGetAll.mockReturnValue([
      { model_name: 'gpt-4o', provider: 'OpenAI' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', context_length: 128000, pricing: { prompt: '0.000003', completion: '0.000012' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { model_name: 'gpt-4o' },
      {
        provider: 'OpenAI',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000012,
        context_window: 128000,
      },
    );
    // Should NOT include capability or quality fields
    const updateFields = mockUpdate.mock.calls[0][1];
    expect(updateFields).not.toHaveProperty('capability_reasoning');
    expect(updateFields).not.toHaveProperty('capability_code');
    expect(updateFields).not.toHaveProperty('quality_score');
  });

  it('skips new models not in the curated list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/o3', context_length: 200000, pricing: { prompt: '0.000002', completion: '0.000008' } },
          { id: 'deepseek/deepseek-r1', pricing: { prompt: '0.00000055', completion: '0.00000219' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 0 when API returns non-OK status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('returns 0 when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
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

  it('updates Zhipu models from OpenRouter response', async () => {
    mockGetAll.mockReturnValue([
      { model_name: 'glm-4-plus', provider: 'Zhipu' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'zhipuai/glm-4-plus', pricing: { prompt: '0.0000005', completion: '0.0000005' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { model_name: 'glm-4-plus' },
      expect.objectContaining({
        provider: 'Zhipu',
        input_price_per_token: 0.0000005,
        output_price_per_token: 0.0000005,
      }),
    );
  });

  it('updates Amazon Nova models from OpenRouter response', async () => {
    mockGetAll.mockReturnValue([
      { model_name: 'nova-pro', provider: 'Amazon' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'amazon/nova-pro', pricing: { prompt: '0.0000008', completion: '0.0000032' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { model_name: 'nova-pro' },
      expect.objectContaining({
        provider: 'Amazon',
        input_price_per_token: 0.0000008,
        output_price_per_token: 0.0000032,
      }),
    );
  });

  it('updates Qwen 3 models from OpenRouter response', async () => {
    mockGetAll.mockReturnValue([
      { model_name: 'qwen3-235b-a22b', provider: 'Alibaba' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'qwen/qwen3-235b-a22b', pricing: { prompt: '0.0000003', completion: '0.0000012' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      { model_name: 'qwen3-235b-a22b' },
      expect.objectContaining({
        provider: 'Alibaba',
        input_price_per_token: 0.0000003,
        output_price_per_token: 0.0000012,
      }),
    );
  });

  it('triggers sync on startup via onModuleInit', async () => {
    mockGetAll.mockReturnValue([
      { model_name: 'claude-opus-4', provider: 'Anthropic' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'anthropic/claude-opus-4', pricing: { prompt: '0.000015', completion: '0.000075' } },
        ],
      }),
    });

    // onModuleInit fires syncPricing as fire-and-forget
    await service.onModuleInit();
    // Allow the async fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('does not crash if startup sync fails', async () => {
    mockFetch.mockRejectedValue(new Error('Startup network error'));

    // Should not throw
    await service.onModuleInit();
    await new Promise((r) => setTimeout(r, 10));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('handles response body with undefined data field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        /* no data field at all */
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('omits context_window when model has no context_length', async () => {
    mockGetAll.mockReturnValue([
      { model_name: 'gpt-4o', provider: 'OpenAI' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'openai/gpt-4o',
            // no context_length
            pricing: { prompt: '0.0000025', completion: '0.00001' },
          },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    const updateFields = mockUpdate.mock.calls[0][1];
    expect(updateFields).not.toHaveProperty('context_window');
  });

  it('detects removed models and calls invalidateOverridesForRemovedModels', async () => {
    // Before sync: cache has two models
    mockGetAll
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'old-model', provider: 'OpenAI' },
      ])
      // During sync: existingModels check
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'old-model', provider: 'OpenAI' },
      ])
      // After reload: old-model is gone
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
    const mockModuleRefGet = (mockModuleRef as { get: jest.Mock }).get;
    mockModuleRefGet.mockReturnValue({
      invalidateOverridesForRemovedModels: mockInvalidate,
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    expect(mockInvalidate).toHaveBeenCalledWith(['old-model']);
  });

  it('logs error when invalidation fails after model removal', async () => {
    // Before sync: cache has a model
    mockGetAll
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'removed', provider: 'OpenAI' },
      ])
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'removed', provider: 'OpenAI' },
      ])
      // After reload: removed model is gone
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

    const mockModuleRefGet = (mockModuleRef as { get: jest.Mock }).get;
    mockModuleRefGet.mockImplementation(() => {
      throw new Error('Module not found');
    });

    // Should not throw — error is caught internally
    const updated = await service.syncPricing();
    expect(updated).toBe(1);
  });

  it('does not reload cache when no models were updated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });
    // Cache has no models, so gpt-4o won't match existingModels
    mockGetAll.mockReturnValue([]);

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockReload).not.toHaveBeenCalled();
  });
});
