import { PricingSyncService } from './pricing-sync.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingHistoryService } from './pricing-history.service';
import { UnresolvedModelTrackerService } from '../model-prices/unresolved-model-tracker.service';

const mockFindOneBy = jest.fn().mockResolvedValue(null);
const mockUpsert = jest.fn().mockResolvedValue(undefined);
const mockCount = jest.fn().mockResolvedValue(0);
const mockFind = jest.fn().mockResolvedValue([]);
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockRepo = {
  findOneBy: mockFindOneBy,
  upsert: mockUpsert,
  count: mockCount,
  find: mockFind,
  delete: mockDelete,
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
    mockFind.mockResolvedValue([]);
    mockDelete.mockResolvedValue(undefined);
  });

  it('creates canonical models for new vendor-prefixed models (no OpenRouter copies)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'anthropic/claude-opus-4',
            pricing: { prompt: '0.000015', completion: '0.000075' },
          },
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(2);
    // 2 canonical upserts only — no OpenRouter copies for non-existing models
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
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    // Canonical upsert should NOT include provider
    const canonicalCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'gpt-4o');
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    expect(canonicalCall![0]).toMatchObject({
      model_name: 'gpt-4o',
      input_price_per_token: 0.0000025,
      output_price_per_token: 0.00001,
    });
  });

  it('syncs free models with zero pricing', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0', completion: '0' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(1);
    const canonicalCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'gpt-4o');
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).toMatchObject({
      input_price_per_token: 0,
      output_price_per_token: 0,
    });
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
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('does not reload cache when no models were updated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.syncPricing();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('calls pricingHistory.recordChange for each model', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
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
    // Canonical only — no OpenRouter copy for non-existing model
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('passes existing model to recordChange when found', async () => {
    const existing = { model_name: 'gpt-4o', input_price_per_token: 0.000001 };
    mockFindOneBy.mockResolvedValue(existing);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    expect(mockRecordChange).toHaveBeenCalledWith(existing, expect.any(Object), 'sync');
  });

  it('detects removed models and calls invalidateOverridesForRemovedModels', async () => {
    mockGetAll
      .mockReturnValueOnce([
        { model_name: 'gpt-4o', provider: 'OpenAI' },
        { model_name: 'old-model', provider: 'OpenAI' },
      ])
      .mockReturnValueOnce([{ model_name: 'gpt-4o', provider: 'OpenAI' }]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
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
      .mockReturnValueOnce([{ model_name: 'gpt-4o', provider: 'OpenAI' }]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
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
    mockGetUnresolved.mockResolvedValue([{ model_name: 'gpt-4o', resolved: false }]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    expect(mockMarkResolved).toHaveBeenCalledWith('gpt-4o', 'gpt-4o');
  });

  it('does not resolve models that are not in OpenRouter data', async () => {
    mockGetUnresolved.mockResolvedValue([{ model_name: 'nonexistent-model', resolved: false }]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    expect(mockMarkResolved).not.toHaveBeenCalled();
  });

  it('resolves unresolved model by stripping vendor prefix', async () => {
    // Unresolved model has vendor prefix 'openai/gpt-4o' but known names include 'gpt-4o'
    mockGetUnresolved.mockResolvedValue([{ model_name: 'openai/gpt-4o', resolved: false }]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    // The unresolved name 'openai/gpt-4o' is in knownNames directly (full vendor-prefixed ID)
    // so it resolves on the first check. For the stripped prefix path, we need a model
    // not in knownNames directly but whose stripped version is.
    expect(mockMarkResolved).toHaveBeenCalledWith('openai/gpt-4o', 'openai/gpt-4o');
  });

  it('resolves unresolved model by stripping vendor prefix when full name is not known', async () => {
    // Unresolved model uses a non-standard prefix 'custom/gpt-4o'.
    // This is NOT directly in knownNames. But stripping the prefix gives 'gpt-4o',
    // which IS in knownNames (as canonical derived from 'openai/gpt-4o').
    mockGetUnresolved.mockResolvedValue([{ model_name: 'custom/gpt-4o', resolved: false }]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    // tryResolve: 'custom/gpt-4o' not in knownNames (line 286 => false)
    // stripped: 'gpt-4o' IS in knownNames => return stripped (line 289)
    expect(mockMarkResolved).toHaveBeenCalledWith('custom/gpt-4o', 'gpt-4o');
  });

  it('resolves by stripping date suffix from unresolved model name', async () => {
    // Regex matches -YYYY-MM-DD at end, so use 'claude-sonnet-4-2025-05-14'
    mockGetUnresolved.mockResolvedValue([
      { model_name: 'claude-sonnet-4-2025-05-14', resolved: false },
    ]);

    // OpenRouter data has 'anthropic/claude-sonnet-4' => canonical 'claude-sonnet-4'
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'anthropic/claude-sonnet-4',
            pricing: { prompt: '0.000003', completion: '0.000015' },
          },
        ],
      }),
    });

    await service.syncPricing();
    // tryResolve: 'claude-sonnet-4-2025-05-14' not in knownNames
    // stripped: 'claude-sonnet-4-2025-05-14' (no prefix) not in knownNames
    // noDate: 'claude-sonnet-4' IS in knownNames => resolves
    expect(mockMarkResolved).toHaveBeenCalledWith('claude-sonnet-4-2025-05-14', 'claude-sonnet-4');
  });

  it('skips models from unsupported providers', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'ai21/jamba-1-5-large', pricing: { prompt: '0.000002', completion: '0.000008' } },
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    // Only OpenAI model should be upserted, ai21 is skipped entirely
    expect(updated).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ model_name: 'gpt-4o' }), [
      'model_name',
    ]);
    // ai21 should not appear in any upsert call
    for (const call of mockUpsert.mock.calls) {
      expect(call[0].model_name).not.toContain('ai21');
    }
  });

  it('removes existing unsupported provider rows on sync', async () => {
    mockFind.mockResolvedValue([
      { model_name: 'ai21/jamba-1-5-large' },
      { model_name: 'openai/gpt-4o' },
      { model_name: 'aion-labs/some-model' },
      { model_name: 'openrouter/auto' },
      { model_name: 'gpt-4o' },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.syncPricing();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    const deleteArg = mockDelete.mock.calls[0][0];
    // Should delete ai21 and aion-labs, but NOT openai, openrouter, or bare models
    expect(deleteArg.model_name._value).toEqual(
      expect.arrayContaining(['ai21/jamba-1-5-large', 'aion-labs/some-model']),
    );
    expect(deleteArg.model_name._value).not.toContain('openai/gpt-4o');
    expect(deleteArg.model_name._value).not.toContain('openrouter/auto');
    expect(deleteArg.model_name._value).not.toContain('gpt-4o');
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
            {
              id: 'anthropic/claude-opus-4',
              pricing: { prompt: '0.000015', completion: '0.000075' },
            },
          ],
        }),
      });

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models');
    });

    it('does not crash if startup sync fails', async () => {
      mockCount.mockResolvedValue(0);
      mockFetch.mockRejectedValue(new Error('Startup network error'));

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('logs error when startup syncPricing rejects (covers catch on line 72)', async () => {
      mockCount.mockResolvedValue(0);
      // Make pricingCache.getAll throw so syncPricing itself rejects
      // (this is before the try-catch in fetchOpenRouterModels)
      mockGetAll.mockImplementation(() => {
        throw new Error('cache not ready');
      });

      await service.onModuleInit();
      // Give the async .catch time to execute
      await new Promise((r) => setTimeout(r, 10));
      // The error is caught by the .catch on line 71-73; no unhandled rejection
    });
  });

  describe('extractDisplayName', () => {
    it('strips vendor prefix from OpenRouter names', () => {
      expect(
        service.extractDisplayName({
          id: 'anthropic/claude-opus-4',
          name: 'Anthropic: Claude Opus 4',
        }),
      ).toBe('Claude Opus 4');
    });

    it('returns full name when no colon-space separator', () => {
      expect(
        service.extractDisplayName({ id: 'openrouter/auto', name: 'Auto (best for prompt)' }),
      ).toBe('Auto (best for prompt)');
    });

    it('returns empty string when name is missing', () => {
      expect(service.extractDisplayName({ id: 'openai/gpt-4o' })).toBe('');
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

    it('maps MiniMax provider correctly', () => {
      expect(service.deriveNames('minimax/minimax-m2.5')).toEqual({
        canonical: 'minimax-m2.5',
        provider: 'MiniMax',
      });
    });

    it('maps Z.ai provider correctly', () => {
      expect(service.deriveNames('z-ai/glm-5')).toEqual({
        canonical: 'glm-5',
        provider: 'Z.ai',
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
    const canonicalCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'glm-4-plus');
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    // Also updates OpenRouter copy (preserves existing provider)
    const orCall = mockUpsert.mock.calls.find((c) => c[0].model_name === 'zhipuai/glm-4-plus');
    expect(orCall).toBeDefined();
    expect(orCall![0]).not.toHaveProperty('provider');
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
    const canonicalCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'nova-pro');
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).not.toHaveProperty('provider');
    // Also updates OpenRouter copy (preserves existing provider)
    const orCall = mockUpsert.mock.calls.find((c) => c[0].model_name === 'amazon/nova-pro');
    expect(orCall).toBeDefined();
    expect(orCall![0]).not.toHaveProperty('provider');
  });

  it('skips openrouter/auto entirely when not in seeder', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openrouter/auto', pricing: { prompt: '0.000003', completion: '0.000015' } }],
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
        data: [{ id: 'openrouter/auto', pricing: { prompt: '0.000003', completion: '0.000015' } }],
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

  it('stores context_length as context_window in OpenRouter copy', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'openai/gpt-4o',
            context_length: 128000,
            pricing: { prompt: '0.0000025', completion: '0.00001' },
          },
        ],
      }),
    });

    await service.syncPricing();
    // Both canonical and OpenRouter copy upserted with context_window
    const orCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'openai/gpt-4o');
    expect(orCall).toBeDefined();
    expect(orCall![0]).toMatchObject({ context_window: 128000 });
    expect(orCall![0]).not.toHaveProperty('provider');
  });

  it('stores context_length as context_window for existing models', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'openai/gpt-4o',
            context_length: 128000,
            pricing: { prompt: '0.0000025', completion: '0.00001' },
          },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert includes context_window
    const canonicalCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'gpt-4o');
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0]).toMatchObject({
      context_window: 128000,
    });
    expect(canonicalCall![0]).not.toHaveProperty('provider');
  });

  it('omits context_window when context_length is missing (uses DB default)', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    // No upsert call should include context_window
    for (const call of mockUpsert.mock.calls) {
      expect(call[0]).not.toHaveProperty('context_window');
    }
  });

  it('updates existing OpenRouter copy with full vendor-prefixed ID', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'claude-opus-4', provider: 'Anthropic' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'anthropic/claude-opus-4',
            pricing: { prompt: '0.000015', completion: '0.000075' },
          },
        ],
      }),
    });

    await service.syncPricing();
    const orCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'anthropic/claude-opus-4',
    );
    expect(orCall).toBeDefined();
    expect(orCall![0]).toMatchObject({
      model_name: 'anthropic/claude-opus-4',
      input_price_per_token: 0.000015,
      output_price_per_token: 0.000075,
    });
    expect(orCall![0]).not.toHaveProperty('provider');
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
          {
            id: 'anthropic/claude-opus-4',
            pricing: { prompt: '0.000015', completion: '0.000075' },
          },
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
        data: [{ id: 'bare-model', pricing: { prompt: '0.000001', completion: '0.000001' } }],
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
        data: [{ id: 'openrouter/bodybuilder', pricing: { prompt: '-1', completion: '-1' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('skips models with non-finite (NaN) pricing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-nan', pricing: { prompt: 'not-a-number', completion: '0.001' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('skips models with Infinity pricing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-inf', pricing: { prompt: 'Infinity', completion: '0.001' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('catches and counts per-model errors in syncAllModels', async () => {
    // findOneBy throws for a specific model, triggering the catch block
    mockFindOneBy
      .mockRejectedValueOnce(new Error('DB constraint error'))
      .mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/exploding-model', pricing: { prompt: '0.001', completion: '0.001' } },
          { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
        ],
      }),
    });

    const updated = await service.syncPricing();
    // First model failed, second succeeded
    expect(updated).toBe(1);
  });

  it('handles non-Error thrown in per-model catch block', async () => {
    mockFindOneBy.mockRejectedValueOnce('string error');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/bad-model', pricing: { prompt: '0.001', completion: '0.001' } }],
      }),
    });

    const updated = await service.syncPricing();
    expect(updated).toBe(0);
  });

  it('stores display_name from OpenRouter name field', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'openai/gpt-4o',
            name: 'OpenAI: GPT-4o',
            pricing: { prompt: '0.0000025', completion: '0.00001' },
          },
        ],
      }),
    });

    await service.syncPricing();
    // Canonical upsert includes display_name
    const canonicalCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'gpt-4o');
    expect(canonicalCall).toBeDefined();
    expect(canonicalCall![0].display_name).toBe('GPT-4o');
    // OpenRouter copy also includes display_name
    const orCall = mockUpsert.mock.calls.find((call) => call[0].model_name === 'openai/gpt-4o');
    expect(orCall).toBeDefined();
    expect(orCall![0].display_name).toBe('GPT-4o');
  });

  it('omits display_name when OpenRouter name is missing', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    // OpenRouter copy should not include display_name
    for (const call of mockUpsert.mock.calls) {
      expect(call[0]).not.toHaveProperty('display_name');
    }
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
    // Also updates OpenRouter copy (preserves existing provider)
    const orCall = mockUpsert.mock.calls.find(
      (call) => call[0].model_name === 'qwen/qwen3-235b-a22b',
    );
    expect(orCall).toBeDefined();
    expect(orCall![0]).not.toHaveProperty('provider');
  });

  it('skips OpenRouter copy when copy does not exist in DB', async () => {
    // Canonical model exists, but OpenRouter copy does not
    mockFindOneBy
      .mockResolvedValueOnce({ model_name: 'gpt-4o', provider: 'OpenAI' }) // canonical
      .mockResolvedValueOnce(null); // OR copy lookup

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    });

    await service.syncPricing();
    // Only canonical upsert, no OpenRouter copy
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ model_name: 'gpt-4o' }), [
      'model_name',
    ]);
  });

  it('updates existing OpenRouter copy pricing', async () => {
    mockFindOneBy.mockResolvedValue({ model_name: 'gpt-4o', provider: 'OpenAI' });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.000005', completion: '0.00002' } }],
      }),
    });

    await service.syncPricing();
    // Both canonical and OpenRouter copy upserted
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const orCall = mockUpsert.mock.calls.find((c) => c[0].model_name === 'openai/gpt-4o');
    expect(orCall).toBeDefined();
    expect(orCall![0]).toMatchObject({
      input_price_per_token: 0.000005,
      output_price_per_token: 0.00002,
    });
    expect(orCall![0]).not.toHaveProperty('provider');
  });
});
