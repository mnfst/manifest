import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../../src/services/api';
import {
  connectionUsage,
  getProviders,
  getProviderUsage,
  mergeUsage,
  type TenantProviderConfig,
  type TenantProviderUsage,
} from '../../../src/services/api/providers';

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

  it('GETs tenant-level provider CONFIG (no usage fields)', async () => {
    const response = {
      providers: [
        {
          provider: 'openai',
          auth_type: 'api_key',
          connection_count: 1,
          connections: [],
          total_models: 0,
        },
      ],
      model_counts: { openai: 10 },
    };
    const fetchMock = setupFetch(response);

    await expect(getProviders()).resolves.toEqual(response);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/providers');
    expect(url).not.toContain('/api/v1/providers/usage');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('GETs provider USAGE from the dedicated endpoint', async () => {
    const response = {
      providers: [
        {
          provider: 'openai',
          auth_type: 'api_key',
          consumption_tokens: 100,
          consumption_messages: 4,
          consumption_cost: 0.25,
          last_used_at: '2026-06-16T10:00:00.000Z',
          sparkline_7d: [0, 0, 0, 0, 0, 0, 100],
        },
      ],
    };
    const fetchMock = setupFetch(response);

    await expect(getProviderUsage()).resolves.toEqual(response);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/providers/usage');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('re-exports the tenant provider clients from the root API barrel', () => {
    expect(api.getGlobalProviders).toBe(getProviders);
    expect(api.getGlobalProviderUsage).toBe(getProviderUsage);
    expect(api.mergeUsage).toBe(mergeUsage);
  });
});

describe('mergeUsage', () => {
  const config: TenantProviderConfig[] = [
    {
      provider: 'openai',
      auth_type: 'api_key',
      connection_count: 1,
      connections: [],
      total_models: 2,
    },
    {
      provider: 'anthropic',
      auth_type: 'subscription',
      connection_count: 1,
      connections: [],
      total_models: 5,
    },
  ];

  it('merges usage into config keyed by (provider, auth_type)', () => {
    const usage: TenantProviderUsage[] = [
      {
        provider: 'openai',
        auth_type: 'api_key',
        consumption_tokens: 100,
        consumption_messages: 4,
        consumption_cost: 0.25,
        last_used_at: '2026-06-16T10:00:00.000Z',
        sparkline_7d: [1, 2, 3],
      },
    ];

    const merged = mergeUsage(config, usage);

    expect(merged).toHaveLength(2);
    const openai = merged.find((m) => m.provider === 'openai')!;
    expect(openai.total_models).toBe(2);
    expect(openai.consumption_tokens).toBe(100);
    expect(openai.sparkline_7d).toEqual([1, 2, 3]);
    // No matching usage row → zeroed usage, config preserved.
    const anthropic = merged.find((m) => m.provider === 'anthropic')!;
    expect(anthropic.consumption_tokens).toBe(0);
    expect(anthropic.consumption_cost).toBe(0);
    expect(anthropic.last_used_at).toBeNull();
    expect(anthropic.sparkline_7d).toEqual([]);
    expect(anthropic.total_models).toBe(5);
  });

  it('zeros every row when usage is still loading (undefined)', () => {
    const merged = mergeUsage(config, undefined);

    expect(merged).toHaveLength(2);
    for (const row of merged) {
      expect(row.consumption_tokens).toBe(0);
      expect(row.consumption_messages).toBe(0);
      expect(row.consumption_cost).toBe(0);
      expect(row.last_used_at).toBeNull();
      expect(row.sparkline_7d).toEqual([]);
    }
  });

  it('does not match across differing auth_type', () => {
    const usage: TenantProviderUsage[] = [
      {
        provider: 'openai',
        auth_type: 'subscription', // config has openai under api_key
        consumption_tokens: 999,
        consumption_messages: 9,
        consumption_cost: 9,
        last_used_at: '2026-06-16T10:00:00.000Z',
        sparkline_7d: [9],
      },
    ];

    const merged = mergeUsage(config, usage);
    const openai = merged.find((m) => m.provider === 'openai')!;
    expect(openai.consumption_tokens).toBe(0);
  });
});

describe('connectionUsage', () => {
  it('distinguishes loading from a loaded connection with no usage', () => {
    expect(connectionUsage(undefined, 'openai', 'api_key', 'Team')).toBeUndefined();

    expect(connectionUsage([], 'openai', 'api_key', 'Team')).toMatchObject({
      provider: 'openai',
      auth_type: 'api_key',
      key_label: 'Team',
      consumption_tokens: 0,
      consumption_messages: 0,
      attempts_30d: 0,
      succeeded_30d: 0,
    });
  });

  it('matches connection labels case-insensitively', () => {
    const usage = {
      provider: 'openai',
      auth_type: 'api_key' as const,
      key_label: 'Team',
      consumption_tokens: 10,
      consumption_messages: 2,
      consumption_cost: 0.1,
      attempts_30d: 3,
      succeeded_30d: 2,
      last_used_at: null,
      sparkline_7d: [],
    };
    expect(connectionUsage([usage], 'openai', 'api_key', 'team')).toBe(usage);
  });
});
