import { ProviderParamSpecService } from '../provider-param-spec.service';

describe('ProviderParamSpecService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockRemoteCatalog(etag: string | null = '"v1"'): void {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? etag : null) },
      json: async () => ({
        models: [
          {
            provider: 'anthropic',
            authType: 'api_key',
            model: 'claude-sonnet-4-6',
            params: [
              {
                path: 'thinking.type',
                type: 'enum',
                label: 'Thinking mode',
                description: 'Controls Anthropic thinking mode.',
                group: 'reasoning',
                default: 'disabled',
                values: ['disabled', 'adaptive', 'enabled'],
              },
            ],
          },
          {
            provider: 'openai',
            authType: 'api_key',
            model: 'gpt-test',
            params: [
              {
                path: 'stream',
                type: 'boolean',
                label: 'Stream',
                description: 'API-level streaming flag.',
                group: 'output_format',
                default: false,
              },
              {
                path: 'temperature',
                type: 'number',
                label: 'Temperature',
                description: 'Controls randomness.',
                group: 'sampling',
                default: 1,
                range: { min: 0, max: 2, step: 0.1 },
              },
              {
                path: 'max_completion_tokens',
                type: 'integer',
                label: 'Max completion tokens',
                description: 'Upper bound on generated tokens.',
                group: 'generation_length',
                range: { min: 1 },
              },
            ],
          },
        ],
      }),
    } as unknown as Response);
  }

  const reasoningEffortParam = {
    path: 'reasoning.effort',
    type: 'enum',
    label: 'Reasoning effort',
    description: 'Controls reasoning effort.',
    group: 'reasoning',
    default: 'medium',
    values: ['low', 'medium', 'high'],
  };

  const temperatureParam = {
    path: 'temperature',
    type: 'number',
    label: 'Temperature',
    description: 'Controls randomness.',
    group: 'sampling',
    default: 1,
    range: { min: 0, max: 2, step: 0.1 },
  };

  function mockProviderlessParams(
    responses: Record<string, readonly Record<string, unknown>[]>,
  ): void {
    fetchSpy.mockImplementation(async (url: string | URL) => {
      const text = String(url);
      for (const [slug, params] of Object.entries(responses)) {
        if (text === `https://modelparams.dev/api/v1/params/${slug}.json`) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({ model: slug, params }),
          } as unknown as Response;
        }
      }
      return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
    });
  }

  it('seeds from the bundled snapshot before the remote catalog loads', async () => {
    const service = new ProviderParamSpecService();

    // Offline fallback: the catalog is non-empty even with no network.
    expect((await service.list()).length).toBeGreaterThan(0);
  });

  it('filters specs by provider, auth type, and model', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    const apiSpecs = await service.getSpecs('anthropic', 'api_key', 'claude-sonnet-4-6');
    const subscriptionSpecs = await service.getSpecs(
      'anthropic',
      'subscription',
      'claude-sonnet-4-6',
    );

    expect(apiSpecs.map((spec) => spec.path)).toContain('thinking.type');
    expect(subscriptionSpecs.map((spec) => spec.path)).toEqual([]);
  });

  it('refreshes specs from modelparams.dev and filters API-level params', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(2);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const remoteSpecs = await service.getSpecs('openai', 'api_key', 'gpt-test');
    expect(remoteSpecs.map((spec) => spec.path)).toEqual(['max_completion_tokens', 'temperature']);
    expect(remoteSpecs.map((spec) => spec.path)).not.toContain('stream');
    await expect(service.list()).resolves.toHaveLength(2);
    expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
  });

  it('uses the providerless model endpoint before provider/auth catalog matches', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();
    fetchSpy.mockClear();
    mockProviderlessParams({
      'gpt-test': [reasoningEffortParam],
    });

    const specs = await service.getSpecs('openai', 'api_key', 'gpt-test');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/params/gpt-test.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(specs).toEqual([
      expect.objectContaining({
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-test',
        path: 'reasoning.effort',
      }),
    ]);
    expect(specs.map((spec) => spec.path)).not.toContain('temperature');
  });

  it('lists model identities without param details', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    expect(service.listModelIds()).toEqual([
      { provider: 'anthropic', authType: 'api_key', model: 'claude-sonnet-4-6' },
      { provider: 'openai', authType: 'api_key', model: 'gpt-test' },
    ]);
  });

  it('loads providerless subscription specs for prefixed Copilot models', async () => {
    mockProviderlessParams({
      'gpt-5.5-subscription': [reasoningEffortParam],
    });
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/gpt-5.5');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/params/gpt-5.5-subscription.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(specs).toEqual([
      expect.objectContaining({
        provider: 'copilot',
        authType: 'subscription',
        model: 'copilot/gpt-5.5',
        path: 'reasoning.effort',
      }),
    ]);
  });

  it('normalizes Copilot Claude dotted minor versions before providerless lookup', async () => {
    mockProviderlessParams({
      'claude-sonnet-4-6-subscription': [reasoningEffortParam],
    });
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/claude-sonnet-4.6');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/params/claude-sonnet-4-6-subscription.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/params/claude-sonnet-4.6-subscription.json',
      expect.anything(),
    );
    expect(specs.map((spec) => spec.path)).toEqual(['reasoning.effort']);
  });

  it('resolves Bedrock Claude model ids through the underlying Anthropic provider for params', async () => {
    mockProviderlessParams({
      'claude-opus-4-8': [reasoningEffortParam],
    });
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('bedrock', 'api_key', 'us.anthropic.claude-opus-4.8');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/params/claude-opus-4-8.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/params/us.anthropic.claude-opus-4.8.json',
      expect.anything(),
    );
    expect(specs).toEqual([
      expect.objectContaining({
        provider: 'bedrock',
        authType: 'api_key',
        model: 'us.anthropic.claude-opus-4.8',
        path: 'reasoning.effort',
      }),
    ]);
  });

  it('strips dated Bedrock model ids for providerless params while preserving the route identity', async () => {
    mockProviderlessParams({
      'gpt-5.4': [reasoningEffortParam],
    });
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('bedrock', 'api_key', 'openai.gpt-5.4-2026-03-05');

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://modelparams.dev/api/v1/params/gpt-5.4-2026-03-05.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://modelparams.dev/api/v1/params/gpt-5.4.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(specs).toEqual([
      expect.objectContaining({
        provider: 'bedrock',
        authType: 'api_key',
        model: 'openai.gpt-5.4-2026-03-05',
        path: 'reasoning.effort',
      }),
    ]);
  });

  it('falls back to the providerless API-key slug for subscription routes', async () => {
    mockProviderlessParams({
      'gpt-4o-mini': [temperatureParam],
    });
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/gpt-4o-mini');

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://modelparams.dev/api/v1/params/gpt-4o-mini-subscription.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://modelparams.dev/api/v1/params/gpt-4o-mini.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(specs).toEqual([
      expect.objectContaining({
        provider: 'copilot',
        authType: 'subscription',
        model: 'copilot/gpt-4o-mini',
        path: 'temperature',
      }),
    ]);
  });

  it('caches providerless hits by slug', async () => {
    mockProviderlessParams({
      'gpt-5.5-subscription': [reasoningEffortParam],
    });
    const service = new ProviderParamSpecService();

    await service.getSpecs('copilot', 'subscription', 'copilot/gpt-5.5');
    await service.getSpecs('copilot', 'subscription', 'copilot/gpt-5.5');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caches providerless misses briefly without refetching immediately', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ model: 'missing-model', params: [] }),
    } as unknown as Response);
    const service = new ProviderParamSpecService();

    await service.getSpecs('openai', 'api_key', 'missing-model');
    await service.getSpecs('openai', 'api_key', 'missing-model');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not cache transient providerless failures', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ model: 'gpt-retry', params: [reasoningEffortParam] }),
      } as unknown as Response);
    const service = new ProviderParamSpecService();

    await expect(service.getSpecs('openai', 'api_key', 'gpt-retry')).resolves.toEqual([]);
    await expect(service.getSpecs('openai', 'api_key', 'gpt-retry')).resolves.toEqual([
      expect.objectContaining({ path: 'reasoning.effort' }),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('bounds providerless cache entries', async () => {
    fetchSpy.mockImplementation(async (url: string | URL) => {
      const slug = String(url).match(/\/params\/(.+)\.json$/)?.[1] ?? 'unknown';
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ model: decodeURIComponent(slug), params: [temperatureParam] }),
      } as unknown as Response;
    });
    const service = new ProviderParamSpecService();

    for (let i = 0; i < 257; i += 1) {
      await service.getSpecs('openai', 'api_key', `gpt-cache-${i}`);
    }
    await service.getSpecs('openai', 'api_key', 'gpt-cache-0');

    expect(fetchSpy).toHaveBeenCalledTimes(258);
  });

  it('canonicalizes provider aliases when listing model identities', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        models: [
          {
            provider: 'z-ai',
            authType: 'subscription',
            model: 'glm-5',
            params: [
              {
                path: 'max_tokens',
                type: 'integer',
                label: 'Max tokens',
                description: 'Upper bound on generated tokens.',
                group: 'generation_length',
                range: { min: 1 },
              },
            ],
          },
        ],
      }),
    } as unknown as Response);
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    expect(service.listModelIds()).toEqual([
      { provider: 'zai', authType: 'subscription', model: 'glm-5' },
    ]);
  });

  it('sends If-None-Match and keeps the cache on a 304 response', async () => {
    mockRemoteCatalog('"v1"');
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    fetchSpy.mockResolvedValue({ status: 304, ok: false } as Response);

    // 304 returns the cached count without re-parsing, and the conditional
    // request carries the previously captured ETag.
    await expect(service.refreshCache()).resolves.toBe(2);
    await expect(service.list()).resolves.toHaveLength(2);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ headers: { 'If-None-Match': '"v1"' } }),
    );
  });

  it('does not set a conditional header when the response has no ETag', async () => {
    mockRemoteCatalog(null);
    const service = new ProviderParamSpecService();
    await service.refreshCache();
    await service.refreshCache();

    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ headers: {} }),
    );
  });

  it('keeps the previous ETag when a 200 response has an invalid body', async () => {
    mockRemoteCatalog('"v1"');
    const service = new ProviderParamSpecService();
    await service.refreshCache(); // adopts "v1"

    // 200 with a NEW ETag but an unparseable catalog — the new tag must not be
    // committed, or a later 304 under it would strand us on the stale cache.
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => '"v2-bad"' },
      json: async () => ({ models: 'not-an-array' }),
    } as unknown as Response);
    await service.refreshCache(); // invalid → keep cache and keep "v1"

    // The next conditional request still carries "v1", proving "v2-bad" was
    // never adopted.
    mockRemoteCatalog('"v3"');
    await service.refreshCache();
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ headers: { 'If-None-Match': '"v1"' } }),
    );
  });

  it('keeps capability-only model entries in the catalog', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        models: [
          {
            provider: 'openai',
            authType: 'api_key',
            model: 'gpt-stream',
            capabilities: ['text', 'stream', 'tools'],
          },
        ],
      }),
    } as unknown as Response);
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(1);

    await expect(service.getSpecs('openai', 'api_key', 'gpt-stream')).resolves.toEqual([]);
    await expect(service.getCapabilities('openai', 'api_key', 'gpt-stream')).resolves.toEqual([
      'text',
      'stream',
      'tools',
    ]);
    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-stream',
        capabilities: ['text', 'stream', 'tools'],
        params: [],
      }),
    ]);
  });

  it('falls back to the bundled snapshot when the initial remote fetch fails', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(0);
    // The seeded snapshot survives a failed refresh — never empty offline.
    expect((await service.list()).length).toBeGreaterThan(0);
    expect(service.getLastFetchedAt()).toBeNull();
  });

  it('swallows network errors and keeps the bundled snapshot', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(0);
    expect((await service.list()).length).toBeGreaterThan(0);
  });

  it('keeps the current cache when a later remote fetch fails', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toHaveLength(2);
    expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
  });

  it('keeps the current cache when the remote catalog shape is invalid', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ models: [{ provider: 'openai', authType: 'api_key' }] }),
    } as unknown as Response);

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toHaveLength(2);
  });

  describe('onModuleInit', () => {
    it('kicks off refreshCache without blocking and loads the catalog', async () => {
      mockRemoteCatalog();
      const service = new ProviderParamSpecService();
      const refresh = jest.spyOn(service, 'refreshCache');

      // Fire-and-forget (must not block boot — see #1894); await the kicked-off
      // refresh deterministically via the spy's returned promise.
      service.onModuleInit();
      await refresh.mock.results[0].value;

      await expect(service.list()).resolves.toHaveLength(2);
    });

    it('does not leave an unhandled rejection when the startup refresh rejects', async () => {
      const service = new ProviderParamSpecService();
      const refresh = jest.spyOn(service, 'refreshCache').mockRejectedValue(new Error('boom'));

      service.onModuleInit();
      // onModuleInit attaches a .catch that swallows the failure.
      await expect(refresh.mock.results[0].value).rejects.toThrow('boom');
    });
  });
});
