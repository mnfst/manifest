import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getProviderTokens } from '../../../src/services/api/public-stats';

describe('getProviderTokens', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    const mockResponse = {
      providers: [
        {
          provider: 'Anthropic',
          total_tokens: 1000,
          models: [{ model: 'claude-sonnet-4-20250514', total_tokens: 1000, daily: [] }],
        },
      ],
      cached_at: '2026-04-08T00:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await getProviderTokens();
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/v1/public/provider-tokens', { cache: 'no-store' });
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(getProviderTokens()).rejects.toThrow('API error: 500 Internal Server Error');
  });
});
