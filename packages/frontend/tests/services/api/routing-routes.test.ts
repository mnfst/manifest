import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as routing from '../../../src/services/api/routing';
import * as specificity from '../../../src/services/api/specificity';
import * as headerTiers from '../../../src/services/api/header-tiers';
import type { ModelRoute } from '../../../src/services/api/routing';

/**
 * The "model-route dual-write" PR teaches the frontend to send both the legacy
 * (model, provider, authType) triple AND the new structured `route` /
 * `routes` payload to every override / fallback endpoint. Older backends that
 * don't know about routes still get the legacy fields; newer backends pick up
 * the unambiguous tuple. These tests pin that contract for the three sibling
 * services (routing, specificity, header-tiers) so a single accidental
 * regression on any of them fails loudly.
 */

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

function lastBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('routing-routes dual-write API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('overrideTier', () => {
    it('sends legacy fields AND structured route when authType is provided', async () => {
      const fetchMock = setupFetch({});
      await routing.overrideTier('my-agent', 'simple', 'gpt-4o', 'openai', 'api_key');

      const body = lastBody(fetchMock);
      expect(body).toEqual({
        model: 'gpt-4o',
        provider: 'openai',
        authType: 'api_key',
        route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
      });
    });

    it('omits the route key entirely when authType is not provided (legacy-only)', async () => {
      const fetchMock = setupFetch({});
      await routing.overrideTier('my-agent', 'simple', 'gpt-4o', 'openai');

      const body = lastBody(fetchMock);
      expect(body).toEqual({ model: 'gpt-4o', provider: 'openai' });
      expect(body).not.toHaveProperty('route');
      expect(body).not.toHaveProperty('authType');
    });

    it('PUTs to the tier-scoped path with the encoded tier id', async () => {
      const fetchMock = setupFetch({});
      await routing.overrideTier('my-agent', 'complex', 'gpt-4o', 'openai', 'api_key');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/routing/my-agent/tiers/complex');
      expect((init as RequestInit).method).toBe('PUT');
    });
  });

  describe('setFallbacks', () => {
    it('sends only `models` when routes are not provided', async () => {
      const fetchMock = setupFetch([]);
      await routing.setFallbacks('my-agent', 'simple', ['m1', 'm2']);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['m1', 'm2'] });
      expect(body).not.toHaveProperty('routes');
    });

    it('sends BOTH `models` and `routes` when routes.length === models.length', async () => {
      const fetchMock = setupFetch([]);
      const routes: ModelRoute[] = [
        { provider: 'openai', authType: 'api_key', model: 'm1' },
        { provider: 'anthropic', authType: 'subscription', model: 'm2' },
      ];
      await routing.setFallbacks('my-agent', 'simple', ['m1', 'm2'], routes);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['m1', 'm2'], routes });
    });

    it('drops `routes` defensively when length drifts from models', async () => {
      const fetchMock = setupFetch([]);
      const routes: ModelRoute[] = [
        { provider: 'openai', authType: 'api_key', model: 'm1' },
      ];
      await routing.setFallbacks('my-agent', 'simple', ['m1', 'm2'], routes);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['m1', 'm2'] });
      expect(body).not.toHaveProperty('routes');
    });

    it('drops `routes` defensively when an empty routes array is passed alongside non-empty models', async () => {
      const fetchMock = setupFetch([]);
      await routing.setFallbacks('my-agent', 'simple', ['m1'], []);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['m1'] });
      expect(body).not.toHaveProperty('routes');
    });
  });

  describe('overrideSpecificity', () => {
    it('sends legacy fields AND structured route when authType is provided', async () => {
      const fetchMock = setupFetch({});
      await specificity.overrideSpecificity(
        'my-agent',
        'coding',
        'claude-opus-4-6',
        'anthropic',
        'subscription',
      );

      const body = lastBody(fetchMock);
      expect(body).toEqual({
        model: 'claude-opus-4-6',
        provider: 'anthropic',
        authType: 'subscription',
        route: {
          provider: 'anthropic',
          authType: 'subscription',
          model: 'claude-opus-4-6',
        },
      });
    });

    it('omits the route key entirely when authType is not provided', async () => {
      const fetchMock = setupFetch({});
      await specificity.overrideSpecificity('my-agent', 'coding', 'gpt-4o', 'openai');

      const body = lastBody(fetchMock);
      expect(body).toEqual({ model: 'gpt-4o', provider: 'openai' });
      expect(body).not.toHaveProperty('route');
    });

    it('PUTs to the category-scoped path', async () => {
      const fetchMock = setupFetch({});
      await specificity.overrideSpecificity('my-agent', 'web_browsing', 'm1', 'openai', 'api_key');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/routing/my-agent/specificity/web_browsing');
      expect((init as RequestInit).method).toBe('PUT');
    });
  });

  describe('setSpecificityFallbacks', () => {
    it('sends only `models` when routes are not provided', async () => {
      const fetchMock = setupFetch([]);
      await specificity.setSpecificityFallbacks('my-agent', 'coding', ['a', 'b']);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['a', 'b'] });
      expect(body).not.toHaveProperty('routes');
    });

    it('sends BOTH `models` and `routes` when lengths match', async () => {
      const fetchMock = setupFetch([]);
      const routes: ModelRoute[] = [
        { provider: 'openai', authType: 'api_key', model: 'a' },
        { provider: 'openai', authType: 'subscription', model: 'a' },
      ];
      await specificity.setSpecificityFallbacks('my-agent', 'coding', ['a', 'a'], routes);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['a', 'a'], routes });
    });

    it('drops `routes` defensively when lengths drift', async () => {
      const fetchMock = setupFetch([]);
      const routes: ModelRoute[] = [
        { provider: 'openai', authType: 'api_key', model: 'a' },
        { provider: 'openai', authType: 'api_key', model: 'b' },
        { provider: 'openai', authType: 'api_key', model: 'c' },
      ];
      await specificity.setSpecificityFallbacks('my-agent', 'coding', ['a', 'b'], routes);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['a', 'b'] });
      expect(body).not.toHaveProperty('routes');
    });
  });

  describe('overrideHeaderTier', () => {
    it('sends legacy fields AND structured route when authType is provided', async () => {
      const fetchMock = setupFetch({});
      await headerTiers.overrideHeaderTier('my-agent', 'ht-1', 'gpt-4o', 'OpenAI', 'api_key');

      const body = lastBody(fetchMock);
      expect(body).toEqual({
        model: 'gpt-4o',
        provider: 'OpenAI',
        authType: 'api_key',
        route: { provider: 'OpenAI', authType: 'api_key', model: 'gpt-4o' },
      });
    });

    it('omits the route key entirely when authType is not provided', async () => {
      const fetchMock = setupFetch({});
      await headerTiers.overrideHeaderTier('my-agent', 'ht-1', 'gpt-4o', 'OpenAI');

      const body = lastBody(fetchMock);
      expect(body).toEqual({ model: 'gpt-4o', provider: 'OpenAI' });
      expect(body).not.toHaveProperty('route');
    });

    it('PUTs to the header-tier override path with the encoded id', async () => {
      const fetchMock = setupFetch({});
      await headerTiers.overrideHeaderTier('my-agent', 'ht with space', 'gpt-4o', 'OpenAI', 'api_key');
      const [url, init] = fetchMock.mock.calls[0];
      // header-tier path uses /override suffix and encodes the id.
      expect(url).toContain('/routing/my-agent/header-tiers/ht%20with%20space/override');
      expect((init as RequestInit).method).toBe('PUT');
    });
  });

  describe('setHeaderTierFallbacks', () => {
    it('sends only `models` when routes are not provided', async () => {
      const fetchMock = setupFetch([]);
      await headerTiers.setHeaderTierFallbacks('my-agent', 'ht-1', ['m1', 'm2']);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['m1', 'm2'] });
      expect(body).not.toHaveProperty('routes');
    });

    it('sends BOTH `models` and `routes` when lengths match', async () => {
      const fetchMock = setupFetch([]);
      const routes: ModelRoute[] = [
        { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        { provider: 'openai', authType: 'subscription', model: 'gpt-4o' },
      ];
      await headerTiers.setHeaderTierFallbacks('my-agent', 'ht-1', ['gpt-4o', 'gpt-4o'], routes);

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['gpt-4o', 'gpt-4o'], routes });
    });

    it('drops `routes` defensively when lengths drift', async () => {
      const fetchMock = setupFetch([]);
      const routes: ModelRoute[] = [
        { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
      ];
      await headerTiers.setHeaderTierFallbacks(
        'my-agent',
        'ht-1',
        ['gpt-4o', 'claude-opus-4-6'],
        routes,
      );

      const body = lastBody(fetchMock);
      expect(body).toEqual({ models: ['gpt-4o', 'claude-opus-4-6'] });
      expect(body).not.toHaveProperty('routes');
    });
  });
});
