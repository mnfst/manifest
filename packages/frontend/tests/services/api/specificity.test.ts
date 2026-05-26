import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as specificity from '../../../src/services/api/specificity';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

function setupFetch(response: unknown = {}, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('specificity API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getSpecificityAssignments GETs the specificity list', async () => {
    const fetchMock = setupFetch([]);
    await specificity.getSpecificityAssignments('demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/routing/demo/specificity');
  });

  it('toggleSpecificity POSTs the active flag', async () => {
    const fetchMock = setupFetch({});
    await specificity.toggleSpecificity('demo', 'coding', true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/specificity/coding/toggle');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ active: true });
  });

  it('toggleSpecificity URL-encodes the category', async () => {
    const fetchMock = setupFetch({});
    await specificity.toggleSpecificity('demo', 'web browsing', false);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/specificity/web%20browsing/toggle');
  });

  it('resetSpecificity DELETEs the category override', async () => {
    const fetchMock = setupFetch({});
    await specificity.resetSpecificity('demo', 'coding');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/routing/demo/specificity/coding');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('setSpecificityResponseMode PATCHes the response-mode endpoint', async () => {
    const fetchMock = setupFetch({ category: 'coding', response_mode: 'stream' });
    const out = await specificity.setSpecificityResponseMode('demo', 'coding', 'stream');
    expect(out).toEqual({ category: 'coding', response_mode: 'stream' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/specificity/coding/response-mode');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      response_mode: 'stream',
    });
  });

  it('setSpecificityFallbacks attaches routes when length matches', async () => {
    const fetchMock = setupFetch([]);
    await specificity.setSpecificityFallbacks(
      'demo',
      'coding',
      ['m'],
      [{ provider: 'openai', authType: 'api_key', model: 'm' }],
    );
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.models).toEqual(['m']);
    expect(body.routes).toHaveLength(1);
  });

  it('setSpecificityFallbacks omits routes when length differs', async () => {
    const fetchMock = setupFetch([]);
    await specificity.setSpecificityFallbacks('demo', 'coding', ['m'], []);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.routes).toBeUndefined();
  });

  it('clearSpecificityFallbacks DELETEs the fallbacks endpoint', async () => {
    const fetchMock = setupFetch({});
    await specificity.clearSpecificityFallbacks('demo', 'coding');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/specificity/coding/fallbacks');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('resetAllSpecificity POSTs to the reset-all endpoint', async () => {
    const fetchMock = setupFetch({});
    await specificity.resetAllSpecificity('demo');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/specificity/reset-all');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('overrideSpecificity attaches the structured route when authType is provided', async () => {
    const fetchMock = setupFetch({});
    await specificity.overrideSpecificity('demo', 'coding', 'gpt-4o', 'openai', 'api_key');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.route).toEqual({ provider: 'openai', authType: 'api_key', model: 'gpt-4o' });
    expect(body.authType).toBe('api_key');
  });

  it('overrideSpecificity omits authType/route when authType is undefined', async () => {
    const fetchMock = setupFetch({});
    await specificity.overrideSpecificity('demo', 'coding', 'gpt-4o', 'openai');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.authType).toBeUndefined();
    expect(body.route).toBeUndefined();
  });
});
