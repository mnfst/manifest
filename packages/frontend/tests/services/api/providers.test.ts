import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../../src/services/api';
import { getProviders } from '../../../src/services/api/providers';

function setupFetch(response: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('providers API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs tenant-level global provider connections', async () => {
    const response = {
      providers: [
        {
          provider: 'openai',
          auth_type: 'api_key',
          connection_count: 1,
          connections: [],
          total_models: 0,
          consumption_tokens: 0,
          consumption_messages: 0,
          consumption_cost: 0,
          last_used_at: null,
          sparkline_7d: [],
        },
      ],
      model_counts: { openai: 10 },
    };
    const fetchMock = setupFetch(response);

    await expect(getProviders()).resolves.toEqual(response);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/providers');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('re-exports the tenant provider client from the root API barrel', () => {
    expect(api.getGlobalProviders).toBe(getProviders);
  });
});
