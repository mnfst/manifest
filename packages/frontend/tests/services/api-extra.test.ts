import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFreeModels } from '../../src/services/api/free-models.js';
import { submitOpenaiOAuthCallback } from '../../src/services/api/oauth.js';
import {
  probeCustomProvider,
  refreshModels,
  deleteCustomProvider,
  updateCustomProvider,
  createCustomProvider,
} from '../../src/services/api/routing.js';
import {
  setSpecificityFallbacks,
  clearSpecificityFallbacks,
  resetAllSpecificity,
} from '../../src/services/api/specificity.js';

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('location', { origin: 'http://localhost:3000' });
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('api/free-models', () => {
  it('fetches /free-models and returns the payload', async () => {
    mockOk({ providers: [], last_synced_at: null });
    const out = await getFreeModels();
    expect(out).toEqual({ providers: [], last_synced_at: null });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/free-models');
  });
});

describe('api/oauth', () => {
  it('submitOpenaiOAuthCallback POSTs code + state as JSON', async () => {
    mockOk({ ok: true });
    const out = await submitOpenaiOAuthCallback('code-1', 'state-1');
    expect(out).toEqual({ ok: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/oauth/openai/callback');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ code: 'code-1', state: 'state-1' });
  });
});

describe('api/routing', () => {
  it('refreshModels POSTs to the refresh endpoint for the agent', async () => {
    mockOk({ ok: true });
    const out = await refreshModels('demo-agent');
    expect(out).toEqual({ ok: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/refresh-models');
    expect(init.method).toBe('POST');
  });

  it('probeCustomProvider POSTs the base URL + optional key and returns the model list', async () => {
    mockOk({ models: [{ model_name: 'llama-3.1-8b' }, { model_name: 'qwen2.5-7b' }] });
    const out = await probeCustomProvider(
      'demo-agent',
      'http://host.docker.internal:8000/v1',
      'sk-local',
    );
    expect(out).toEqual({
      models: [{ model_name: 'llama-3.1-8b' }, { model_name: 'qwen2.5-7b' }],
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/custom-providers/probe');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      base_url: 'http://host.docker.internal:8000/v1',
      apiKey: 'sk-local',
    });
  });

  it('probeCustomProvider works without an apiKey', async () => {
    mockOk({ models: [] });
    await probeCustomProvider('demo-agent', 'http://127.0.0.1:11434/v1');
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.base_url).toBe('http://127.0.0.1:11434/v1');
    expect(body.apiKey).toBeUndefined();
  });

  it('deleteCustomProvider DELETEs the custom provider by ID', async () => {
    mockOk({ ok: true });
    const out = await deleteCustomProvider('demo-agent', 'cp-123');
    expect(out).toEqual({ ok: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/custom-providers/cp-123');
    expect(init.method).toBe('DELETE');
  });

  it('createCustomProvider POSTs with name, base_url, and models', async () => {
    const payload = { id: 'cp-new', name: 'My LLM', base_url: 'http://localhost:8080/v1', has_api_key: false, models: [], created_at: '2025-01-01' };
    mockOk(payload);
    const out = await createCustomProvider('demo-agent', {
      name: 'My LLM',
      base_url: 'http://localhost:8080/v1',
      models: [],
    });
    expect(out).toEqual(payload);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/custom-providers');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'My LLM',
      base_url: 'http://localhost:8080/v1',
      models: [],
    });
  });

  it('updateCustomProvider PUTs updated fields for an existing provider', async () => {
    const payload = { id: 'cp-1', name: 'Updated', base_url: 'http://new:8080/v1', has_api_key: true, models: [], created_at: '2025-01-01' };
    mockOk(payload);
    const out = await updateCustomProvider('demo-agent', 'cp-1', {
      name: 'Updated',
      base_url: 'http://new:8080/v1',
    });
    expect(out).toEqual(payload);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/custom-providers/cp-1');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
  });
});

describe('api/specificity', () => {
  it('setSpecificityFallbacks PUTs the list of models', async () => {
    mockOk(['m1', 'm2']);
    const out = await setSpecificityFallbacks('demo-agent', 'coding', ['m1', 'm2']);
    expect(out).toEqual(['m1', 'm2']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/specificity/coding/fallbacks');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ models: ['m1', 'm2'] });
  });

  it('clearSpecificityFallbacks DELETEs the fallbacks collection', async () => {
    mockOk(undefined);
    await clearSpecificityFallbacks('demo-agent', 'coding');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/specificity/coding/fallbacks');
    expect(init.method).toBe('DELETE');
  });

  it('resetAllSpecificity POSTs to the reset-all endpoint', async () => {
    mockOk(undefined);
    await resetAllSpecificity('demo-agent');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/routing/demo-agent/specificity/reset-all');
    expect(init.method).toBe('POST');
  });
});
