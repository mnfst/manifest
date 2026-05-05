import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from '../../src/services/api/header-tiers';

function setupFetch(response: unknown = {}, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('header-tiers API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listHeaderTiers GETs the agent-scoped tier list', async () => {
    const fetchMock = setupFetch([{ id: 'ht-1' }]);
    const out = await api.listHeaderTiers('my-agent');
    expect(out).toEqual([{ id: 'ht-1' }]);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/routing/my-agent/header-tiers');
  });

  it('getSeenHeaders appends scope=all when passed', async () => {
    const fetchMock = setupFetch([]);
    await api.getSeenHeaders('my-agent', 'all');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/routing/my-agent/seen-headers?scope=all');
  });

  it('getSeenHeaders omits the query string when scope is unspecified', async () => {
    const fetchMock = setupFetch([]);
    await api.getSeenHeaders('my-agent');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/routing/my-agent/seen-headers');
    expect(url).not.toContain('scope=');
  });

  it('createHeaderTier POSTs the body', async () => {
    const fetchMock = setupFetch({ id: 'ht-new' });
    const input = {
      name: 'Premium',
      header_key: 'x-manifest-tier',
      header_value: 'premium',
      badge_color: 'indigo' as const,
    };
    const out = await api.createHeaderTier('my-agent', input);
    expect(out).toEqual({ id: 'ht-new' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it('updateHeaderTier PUTs the patch', async () => {
    const fetchMock = setupFetch({ id: 'ht-1' });
    await api.updateHeaderTier('my-agent', 'ht-1', { name: 'New' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/ht-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ name: 'New' });
  });

  it('deleteHeaderTier DELETEs by id', async () => {
    const fetchMock = setupFetch({});
    await api.deleteHeaderTier('my-agent', 'ht-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/ht-1');
    expect(init.method).toBe('DELETE');
  });

  it('reorderHeaderTiers POSTs the id list', async () => {
    const fetchMock = setupFetch({});
    await api.reorderHeaderTiers('my-agent', ['a', 'b']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/reorder');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ids: ['a', 'b'] });
  });

  it('overrideHeaderTier includes authType + structured route only when authType is provided', async () => {
    const fetchMock = setupFetch({});
    await api.overrideHeaderTier('my-agent', 'ht-1', 'gpt-4o', 'OpenAI');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: 'gpt-4o',
      provider: 'OpenAI',
    });
    await api.overrideHeaderTier('my-agent', 'ht-1', 'gpt-4o', 'OpenAI', 'api_key');
    // Dual-write: legacy fields PLUS the structured route. Older backends
    // pick up authType, newer backends prefer the unambiguous route tuple.
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      model: 'gpt-4o',
      provider: 'OpenAI',
      authType: 'api_key',
      route: { provider: 'OpenAI', authType: 'api_key', model: 'gpt-4o' },
    });
  });

  it('resetHeaderTier DELETEs the override', async () => {
    const fetchMock = setupFetch({});
    await api.resetHeaderTier('my-agent', 'ht-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/ht-1/override');
    expect(init.method).toBe('DELETE');
  });

  it('setHeaderTierFallbacks PUTs the models list', async () => {
    const fetchMock = setupFetch(['m']);
    await api.setHeaderTierFallbacks('my-agent', 'ht-1', ['m1', 'm2']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/ht-1/fallbacks');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ models: ['m1', 'm2'] });
  });

  it('clearHeaderTierFallbacks DELETEs fallbacks', async () => {
    const fetchMock = setupFetch({});
    await api.clearHeaderTierFallbacks('my-agent', 'ht-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/ht-1/fallbacks');
    expect(init.method).toBe('DELETE');
  });

  it('toggleHeaderTier PATCHes the enabled flag', async () => {
    const fetchMock = setupFetch({ id: 'ht-1', enabled: true });
    const out = await api.toggleHeaderTier('my-agent', 'ht-1', true);
    expect(out).toEqual({ id: 'ht-1', enabled: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/header-tiers/ht-1/toggle');
    expect(init.method).toBe('PATCH');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ enabled: true });
  });
});
