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

  it('lists model identities without param details', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    expect(service.listModelIds()).toEqual([
      { provider: 'anthropic', authType: 'api_key', model: 'claude-sonnet-4-6' },
      { provider: 'openai', authType: 'api_key', model: 'gpt-test' },
    ]);
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
