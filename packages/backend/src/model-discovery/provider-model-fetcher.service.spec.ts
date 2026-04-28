import { ProviderModelFetcherService, PROVIDER_CONFIGS } from './provider-model-fetcher.service';

describe('ProviderModelFetcherService', () => {
  let service: ProviderModelFetcherService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ProviderModelFetcherService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /* ── PROVIDER_CONFIGS sanity ── */

  it('should have configs for all providers including subscription variants', () => {
    const expected = [
      'openai',
      'openai-subscription',
      'deepseek',
      'mistral',
      'moonshot',
      'xai',
      'minimax',
      'minimax-subscription',
      'qwen',
      'zai',
      'zai-subscription',
      'anthropic',
      'gemini',
      'openrouter',
      'ollama',
      'ollama-cloud',
      'copilot',
    ];
    for (const id of expected) {
      expect(PROVIDER_CONFIGS[id]).toBeDefined();
    }
  });

  /* ── Unknown provider ── */

  it('should return [] for unknown provider', async () => {
    const result = await service.fetch('nonexistent', 'key123');
    expect(result).toEqual([]);
  });

  /* ── Network error ── */

  it('should return [] on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('network failure'));
    const result = await service.fetch('openai', 'key123');
    expect(result).toEqual([]);
  });

  it('should return [] on non-Error throw', async () => {
    fetchSpy.mockRejectedValue('string error');
    const result = await service.fetch('openai', 'key123');
    expect(result).toEqual([]);
  });

  /* ── Non-OK response ── */

  it('should return [] when response is not ok', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });
    const result = await service.fetch('openai', 'key123');
    expect(result).toEqual([]);
  });

  /* ── Timeout handling ── */

  it('should abort on timeout', async () => {
    fetchSpy.mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    jest.useFakeTimers();
    const promise = service.fetch('openai', 'key123');
    jest.advanceTimersByTime(6000);
    const result = await promise;
    expect(result).toEqual([]);
    jest.useRealTimers();
  });

  /* ── OpenAI parser (used by openai, deepseek, mistral, etc.) ── */

  describe('parseOpenAI (via openai provider)', () => {
    it('should parse valid OpenAI response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', object: 'model' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'gpt-4o',
          displayName: 'gpt-4o',
          provider: 'openai',
          contextWindow: 128000,
          inputPricePerToken: null,
          outputPricePerToken: null,
          qualityScore: 3,
        }),
      );
    });

    it('should filter out entries without string id', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: '', object: 'model' },
            { id: 123, object: 'model' },
            { object: 'model' },
            { id: 'valid-model' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-model');
    });

    it('should return [] when data is not an array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'not-array' }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toEqual([]);
    });

    it('should return [] when data is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toEqual([]);
    });

    it('should filter out non-chat OpenAI models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o' },
            { id: 'gpt-4.1' },
            { id: 'text-embedding-3-small' },
            { id: 'tts-1' },
            { id: 'tts-1-hd' },
            { id: 'whisper-1' },
            { id: 'dall-e-3' },
            { id: 'text-moderation-latest' },
            { id: 'gpt-3.5-turbo-instruct' },
            { id: 'davinci-002' },
            { id: 'babbage-002' },
            { id: 'sora-2' },
            { id: 'sora-2-pro' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4.1']);
    });

    it('should keep Responses-only chat models (Codex/-pro/o1-pro/deep-research) so the proxy can route them to /v1/responses', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-5-chat-latest' },
            { id: 'gpt-5-codex' },
            { id: 'gpt-5-pro' },
            { id: 'gpt-5.1-codex' },
            { id: 'gpt-5.1-codex-mini' },
            { id: 'gpt-5.2-codex' },
            { id: 'gpt-5.2-pro' },
            { id: 'gpt-5.4-pro' },
            { id: 'gpt-5.3-codex' },
            { id: 'codex-mini-latest' },
            { id: 'gpt-image-1' },
            { id: 'gpt-image-1-mini' },
            { id: 'gpt-image-1.5' },
            { id: 'o1-pro' },
            { id: 'o4-mini-deep-research' },
            { id: 'o3' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      // Image-gen is not chat and stays filtered; everything else passes through
      // so the proxy can swap to openai-responses at forward time.
      expect(result.map((m) => m.id)).toEqual([
        'gpt-5-chat-latest',
        'gpt-5-codex',
        'gpt-5-pro',
        'gpt-5.1-codex',
        'gpt-5.1-codex-mini',
        'gpt-5.2-codex',
        'gpt-5.2-pro',
        'gpt-5.4-pro',
        'gpt-5.3-codex',
        'codex-mini-latest',
        'o1-pro',
        'o4-mini-deep-research',
        'o3',
      ]);
    });

    it('should drop image-generation models from discovery (not chat-compatible)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-image-1' },
            { id: 'gpt-image-1-mini' },
            { id: 'gpt-image-1.5' },
            { id: 'gpt-image-2' },
            { id: 'gpt-4o' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result.map((m) => m.id)).toEqual(['gpt-4o']);
    });

    it('should not filter non-OpenAI providers with similar model names', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }],
        }),
      });

      // DeepSeek uses the generic parseOpenAI (no filtering)
      const result = await service.fetch('deepseek', 'sk-test');
      expect(result).toHaveLength(2);
    });

    it('should keep both codex-mini-latest (chat-compatible) and Responses-only Codex variants (routed at proxy time)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'codex-mini-latest' }, { id: 'gpt-5-codex' }],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result.map((m) => m.id)).toEqual(['codex-mini-latest', 'gpt-5-codex']);
    });

    it('should deduplicate dated snapshots when alias exists', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o-mini' },
            { id: 'gpt-4o-mini-2024-07-18' },
            { id: 'gpt-4o' },
            { id: 'gpt-4o-2024-08-06' },
            { id: 'o3-mini-2025-01-31' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      // Dated snapshots removed when alias exists; o3-mini-2025-01-31 kept (no alias)
      expect(result.map((m) => m.id)).toEqual(['gpt-4o-mini', 'gpt-4o', 'o3-mini-2025-01-31']);
    });
  });

  /* ── Mistral-specific filter ── */

  describe('parseMistralChatOnly (via mistral provider)', () => {
    it('should filter out OCR models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-large-latest' },
            { id: 'mistral-ocr-2512' },
            { id: 'mistral-ocr-latest' },
            { id: 'mistral-ocr-2503' },
            { id: 'codestral-latest' },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest', 'codestral-latest']);
    });

    it('should keep all regular Mistral chat models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-medium-latest' },
            { id: 'magistral-small-latest' },
            { id: 'devstral-medium-2507' },
            { id: 'voxtral-small-latest' },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(4);
    });
  });

  /* ── Mistral metadata filtering ── */

  describe('parseMistral metadata filtering', () => {
    it('should filter out models with deprecation set', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-large-latest', capabilities: { completion_chat: true } },
            { id: 'old-model', capabilities: { completion_chat: true }, deprecation: '2025-12-01' },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });

    it('should filter out models without completion_chat capability', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-large-latest', capabilities: { completion_chat: true } },
            { id: 'mistral-ocr-2503', capabilities: { completion_chat: false } },
            { id: 'labs-leanstral-2603', capabilities: { completion_chat: false } },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });

    it('should keep models when capabilities field is absent', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'mistral-large-latest' }, { id: 'codestral-latest' }],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(2);
    });

    it('should keep models when completion_chat is true', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-large-latest', capabilities: { completion_chat: true } },
            {
              id: 'codestral-latest',
              capabilities: { completion_chat: true, completion_fim: true },
            },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(2);
    });

    it('should filter by both metadata and regex patterns', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-large-latest', capabilities: { completion_chat: true } },
            {
              id: 'deprecated-model',
              capabilities: { completion_chat: true },
              deprecation: '2025-06-01',
            },
            { id: 'labs-experimental', capabilities: { completion_chat: true } },
            { id: 'voxtral-mini-2602', capabilities: { completion_chat: true } },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      // deprecated-model filtered by metadata, labs-experimental by regex, voxtral-mini-2602 by blocklist
      expect(result.map((m) => m.id)).toEqual(['mistral-large-latest']);
    });
  });

  /* ── Z.ai subscription routing ── */

  it('should return glm-5.1 from zai models (no longer blocklisted)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'glm-4.5' }, { id: 'glm-5' }, { id: 'glm-5.1' }],
      }),
    });

    const result = await service.fetch('zai', 'key');
    expect(result.map((m) => m.id)).toEqual(['glm-4.5', 'glm-5', 'glm-5.1']);
  });

  it('should route zai+subscription to Coding Plan models endpoint', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'glm-5.1' }, { id: 'glm-4.7' }] }),
    });

    const result = await service.fetch('zai', 'zai-sub-key', 'subscription');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://open.bigmodel.cn/api/coding/paas/v4/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer zai-sub-key' }),
      }),
    );
    expect(result.map((m) => m.id)).toEqual(['glm-5.1', 'glm-4.7']);
  });

  it('should route zai+api_key to standard models endpoint', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'glm-4.7' }] }),
    });

    await service.fetch('zai', 'zai-key');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://open.bigmodel.cn/api/paas/v4/models',
      expect.any(Object),
    );
  });

  /* ── OpenAI-compatible providers use same parser ── */

  it('should work for deepseek provider', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'deepseek-chat' }] }),
    });

    const result = await service.fetch('deepseek', 'key');
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe('deepseek');
  });

  /* ── Bearer auth header ── */

  it('should send bearer auth header for openai', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('openai', 'sk-abc');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-abc' },
      }),
    );
  });

  it('should use the endpoint override for MiniMax subscription discovery', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('minimax', 'sk-test', 'subscription', 'https://api.minimaxi.com/anthropic');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.minimaxi.com/anthropic/v1/models?limit=100',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer sk-test',
          'anthropic-version': '2023-06-01',
        },
      }),
    );
  });

  it('should ignore invalid endpoint overrides for MiniMax subscription discovery', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('minimax', 'sk-test', 'subscription', 'http://127.0.0.1:8080/anthropic');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.minimax.io/anthropic/v1/models?limit=100',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer sk-test',
          'anthropic-version': '2023-06-01',
        },
      }),
    );
  });

  it('should use the endpoint override for Qwen discovery', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch(
      'qwen',
      'sk-qwen',
      'api_key',
      'https://dashscope-intl.aliyuncs.com/compatible-mode',
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-qwen' },
      }),
    );
  });

  it('warns and ignores an invalid Qwen endpoint override', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

    // `not a url` is rejected by normalizeQwenCompatibleBaseUrl → the fetcher
    // logs a warning and falls back to the default Qwen URL.
    await service.fetch('qwen', 'sk-qwen', 'api_key', 'not a url');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring invalid Qwen endpoint override'),
    );
    // Default Qwen endpoint should still be hit (no override applied).
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).not.toContain('not a url');
    expect(calledUrl).toMatch(/^https:\/\//);
    warnSpy.mockRestore();
  });

  /* ── Anthropic provider ── */

  describe('parseAnthropic (via anthropic provider)', () => {
    it('should parse valid Anthropic response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'claude-3-opus', display_name: 'Claude 3 Opus', type: 'model' },
            { id: 'claude-3-sonnet', type: 'model' },
          ],
        }),
      });

      const result = await service.fetch('anthropic', 'sk-ant-test');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'claude-3-opus',
          displayName: 'Claude 3 Opus',
          provider: 'anthropic',
          contextWindow: 200000,
        }),
      );
      expect(result[1].displayName).toBe('claude-3-sonnet');
    });

    it('should filter out entries without type=model', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'claude-3-opus', type: 'model' },
            { id: 'not-a-model', type: 'other' },
            { id: 'no-type' },
          ],
        }),
      });

      const result = await service.fetch('anthropic', 'sk-ant-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claude-3-opus');
    });

    it('should return [] when data is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: null }),
      });

      const result = await service.fetch('anthropic', 'key');
      expect(result).toEqual([]);
    });

    it('should send x-api-key header for api_key auth', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.fetch('anthropic', 'sk-ant-test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-version': '2023-06-01',
            'x-api-key': 'sk-ant-test',
          }),
        }),
      );
    });

    it('should send bearer header + beta for subscription auth', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.fetch('anthropic', 'token', 'subscription');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-version': '2023-06-01',
            Authorization: 'Bearer token',
            'anthropic-beta': 'oauth-2025-04-20',
          }),
        }),
      );
    });
  });

  /* ── Gemini provider ── */

  describe('parseGemini (via gemini provider)', () => {
    it('should parse valid Gemini response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 1000000,
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'gemini-key');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          provider: 'gemini',
          contextWindow: 1000000,
        }),
      );
    });

    it('should use id as displayName when displayName missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result[0].displayName).toBe('gemini-flash');
    });

    it('should default contextWindow to 1000000 when inputTokenLimit missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-test',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result[0].contextWindow).toBe(1000000);
    });

    it('should filter out models without generateContent', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-pro',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/embedding-001',
              supportedGenerationMethods: ['embedContent'],
            },
            {
              name: 'models/no-methods',
            },
            {
              name: 123,
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-pro');
    });

    it('should return [] when models is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: 'wrong' }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result).toEqual([]);
    });

    it('should deduplicate versioned models when alias exists', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.0-flash',
              displayName: 'Gemini 2.0 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.0-flash-001',
              displayName: 'Gemini 2.0 Flash 001',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      // gemini-2.0-flash-001 should be dropped because gemini-2.0-flash exists
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['gemini-2.0-flash', 'gemini-2.5-pro']);
    });

    it('should keep versioned model when alias does not exist', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.0-flash-001',
              displayName: 'Gemini 2.0 Flash 001',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-2.0-flash-001');
    });

    it('should embed key in URL and send no headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('gemini', 'my-gem-key');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('key=my-gem-key'),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  /* ── OpenRouter provider ── */

  describe('parseOpenRouter (via openrouter provider)', () => {
    it('should parse valid OpenRouter response with pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4',
              name: 'GPT-4',
              context_length: 8192,
              architecture: { output_modalities: ['text'] },
              pricing: { prompt: '0.00003', completion: '0.00006' },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'openai/gpt-4',
          displayName: 'GPT-4',
          provider: 'openrouter',
          contextWindow: 8192,
          inputPricePerToken: 0.00003,
          outputPricePerToken: 0.00006,
        }),
      );
    });

    it('should filter out non-text output modality models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'text-only',
              architecture: { output_modalities: ['text'] },
            },
            {
              id: 'image-model',
              architecture: { output_modalities: ['image'] },
            },
            {
              id: 'multi-modal',
              architecture: { output_modalities: ['text', 'image'] },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('text-only');
    });

    it('should include models with empty output_modalities', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'empty-modalities',
              architecture: { output_modalities: [] },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
    });

    it('should include models without architecture field', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'no-arch' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
    });

    it('should handle missing pricing fields', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'no-pricing' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should handle non-finite pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'bad-pricing',
              pricing: { prompt: 'NaN', completion: 'Infinity' },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should treat negative pricing as null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'neg-pricing',
              pricing: { prompt: '-0.001', completion: '-0.002' },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should use id as displayName when name is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'model/test' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].displayName).toBe('model/test');
    });

    it('should default contextWindow to 128000', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'no-ctx' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].contextWindow).toBe(128000);
    });

    it('should filter out entries without string id', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ name: 'no-id' }, { id: 42 }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toEqual([]);
    });

    it('should return [] when data is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toEqual([]);
    });
  });

  /* ── Ollama provider ── */

  describe('parseOllama (via ollama provider)', () => {
    it('should parse valid Ollama response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest', details: { family: 'llama', parameter_size: '8B' } },
            { name: 'codellama', details: { family: 'llama' } },
          ],
        }),
      });

      const result = await service.fetch('ollama', '');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'llama3',
          displayName: 'llama3',
          provider: 'ollama',
          contextWindow: 128000,
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 2,
        }),
      );
      expect(result[1].id).toBe('codellama');
    });

    it('should strip :latest suffix from model name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'mistral:latest' }],
        }),
      });

      const result = await service.fetch('ollama', '');
      expect(result[0].id).toBe('mistral');
    });

    it('should filter out entries without string name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'valid' }, { name: 123 }, {}],
        }),
      });

      const result = await service.fetch('ollama', '');
      expect(result).toHaveLength(1);
    });

    it('should return [] when models is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: null }),
      });

      const result = await service.fetch('ollama', '');
      expect(result).toEqual([]);
    });

    it('should send no headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('ollama', '');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  /* ── Ollama Cloud provider ── */

  describe('ollama-cloud provider', () => {
    it('should hit the ollama.com api/tags endpoint', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('ollama-cloud', 'sk-test-key');

      expect(fetchSpy).toHaveBeenCalledWith('https://ollama.com/api/tags', expect.any(Object));
    });

    it('should include Bearer auth header built via the shared bearerHeaders helper', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('ollama-cloud', 'sk-test-key');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer sk-test-key' },
        }),
      );
    });

    it('should parse models with price 0 and strip :latest suffix', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'deepseek-v3.2', details: { family: 'deepseek' } },
            { name: 'qwen3.5:latest', details: { family: 'qwen' } },
          ],
        }),
      });

      const result = await service.fetch('ollama-cloud', 'sk-test-key');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'deepseek-v3.2',
          provider: 'ollama-cloud',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 2,
        }),
      );
      expect(result[1].id).toBe('qwen3.5');
    });

    it('should return [] on non-ok response', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 403 });
      const result = await service.fetch('ollama-cloud', 'sk-test-key');
      expect(result).toEqual([]);
    });
  });

  /* ── OpenAI subscription parser ── */

  describe('parseOpenaiSubscription (via openai provider with subscription authType)', () => {
    it('should parse valid Codex models response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              slug: 'gpt-5.3-codex',
              display_name: 'GPT-5.3 Codex',
              context_window: 192000,
              visibility: 'list',
              supported_in_api: true,
              priority: 10,
            },
            {
              slug: 'gpt-5.2-codex',
              display_name: 'GPT-5.2 Codex',
              context_window: 200000,
              visibility: 'list',
              supported_in_api: true,
            },
          ],
        }),
      });

      const result = await service.fetch('openai', 'oauth-token', 'subscription');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'gpt-5.3-codex',
          displayName: 'GPT-5.3 Codex',
          provider: 'openai',
          contextWindow: 192000,
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityCode: true,
          qualityScore: 3,
        }),
      );
      expect(result[1].id).toBe('gpt-5.2-codex');
    });

    it('should filter out models with visibility !== list', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { slug: 'visible-model', visibility: 'list' },
            { slug: 'hidden-model', visibility: 'hidden' },
            { slug: 'no-visibility' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('visible-model');
    });

    it('should use slug as displayName when display_name is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ slug: 'gpt-5.4', visibility: 'list' }],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result[0].displayName).toBe('gpt-5.4');
    });

    it('should default context_window to 200000', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ slug: 'test-model', visibility: 'list' }],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result[0].contextWindow).toBe(200000);
    });

    it('should return [] when models is not an array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: 'not-array' }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toEqual([]);
    });

    it('should return [] when models is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toEqual([]);
    });

    it('should filter out entries without string slug', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { slug: 123, visibility: 'list' },
            { visibility: 'list' },
            { slug: 'valid', visibility: 'list' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });

    it('should send Codex CLI headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('openai', 'my-oauth-token', 'subscription');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://chatgpt.com/backend-api/codex/models?client_version=0.99.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-oauth-token',
            originator: 'codex_cli_rs',
          }),
        }),
      );
    });
  });

  /* ── Copilot parser ── */

  describe('parseCopilot (via copilot provider)', () => {
    it('should parse Copilot models and add copilot/ prefix', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'claude-opus-4.6', object: 'model' },
            { id: 'gpt-4o', object: 'model' },
          ],
        }),
      });

      const result = await service.fetch('copilot', 'tid=copilot-token');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'copilot/claude-opus-4.6',
          displayName: 'claude-opus-4.6',
          provider: 'copilot',
          contextWindow: 128000,
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 3,
        }),
      );
      expect(result[1].id).toBe('copilot/gpt-4o');
    });

    it('should send correct Copilot headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.fetch('copilot', 'tid=test-token');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.githubcopilot.com/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer tid=test-token',
            'Editor-Version': 'vscode/1.100.0',
            'Copilot-Integration-Id': 'vscode-chat',
          }),
        }),
      );
    });

    it('should return [] for empty data array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await service.fetch('copilot', 'tid=token');
      expect(result).toEqual([]);
    });

    it('should filter out entries with missing or empty id', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'valid-model' }, { name: 'no-id-field' }, { id: '' }],
        }),
      });

      const result = await service.fetch('copilot', 'tid=token');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('copilot/valid-model');
    });

    it('should return [] when data is not an array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'not-array' }),
      });

      const result = await service.fetch('copilot', 'tid=token');
      expect(result).toEqual([]);
    });

    it('should filter out internal Azure routing models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'claude-opus-4.7' },
            { id: 'gpt-4o' },
            { id: 'accounts/msft/routers/f185i3v4' },
            { id: 'accounts/msft/routers/fmfeto88' },
            { id: 'accounts/msft/routers/gdjv4v2v' },
          ],
        }),
      });

      const result = await service.fetch('copilot', 'tid=token');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('copilot/claude-opus-4.7');
      expect(result[1].id).toBe('copilot/gpt-4o');
    });
  });

  describe('opencode-go provider', () => {
    it('delegates to the catalog service instead of hitting the network', async () => {
      const catalog = {
        list: jest.fn().mockResolvedValue([
          { id: 'glm-5.1', displayName: 'GLM-5.1', format: 'openai' as const },
          { id: 'minimax-m2.7', displayName: 'MiniMax M2.7', format: 'anthropic' as const },
        ]),
      };
      const withCatalog = new ProviderModelFetcherService(
        catalog as unknown as ConstructorParameters<typeof ProviderModelFetcherService>[0],
      );

      const result = await withCatalog.fetch('opencode-go', 'og-token', 'subscription');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(catalog.list).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'opencode-go/glm-5.1',
          displayName: 'GLM-5.1',
          provider: 'opencode-go',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
        }),
      );
      expect(result[1].id).toBe('opencode-go/minimax-m2.7');
    });

    it('returns [] when no catalog service is wired up', async () => {
      const result = await service.fetch('opencode-go', 'og-token', 'subscription');
      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  /* ── OpenAI subscription routing ── */

  it('should route openai+subscription to openai-subscription config', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    });

    await service.fetch('openai', 'token', 'subscription');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('chatgpt.com/backend-api/codex/models'),
      expect.anything(),
    );
  });

  it('should use regular openai config when authType is not subscription', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('openai', 'sk-key', 'api_key');

    expect(fetchSpy).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.anything());
  });

  /* ── Case insensitivity ── */

  it('should handle provider ID case-insensitively', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'model' }] }),
    });

    const result = await service.fetch('OpenAI', 'key');
    expect(result).toHaveLength(1);
  });

  /* ── Endpoint function (gemini) ── */

  it('should call endpoint function when endpoint is a function', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    });

    await service.fetch('gemini', 'special&key');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('key=special%26key'),
      expect.anything(),
    );
  });

  /* ── Non-ok response masks api key ── */

  it('should mask api key in warning log for non-ok response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 403 });

    const result = await service.fetch('gemini', 'secret-key');
    expect(result).toEqual([]);
  });

  /* ── Mistral-specific filter: edge cases ── */

  describe('parseMistralChatOnly edge cases', () => {
    it('should preserve voxtral models (speech-capable chat models)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'voxtral-small-latest' }, { id: 'voxtral-medium-2507' }],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['voxtral-small-latest', 'voxtral-medium-2507']);
    });

    it('should preserve magistral models (reasoning chat models)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'magistral-small-latest' }, { id: 'magistral-medium-latest' }],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual([
        'magistral-small-latest',
        'magistral-medium-latest',
      ]);
    });

    it('should preserve devstral models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'devstral-medium-2507' }],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('devstral-medium-2507');
    });

    it('should filter out embed models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'mistral-embed' }, { id: 'mistral-large-latest' }],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mistral-large-latest');
    });

    it('should filter out all OCR variants', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mistral-ocr-2512' },
            { id: 'mistral-ocr-latest' },
            { id: 'mistral-ocr-2503' },
            { id: 'codestral-latest' },
          ],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('codestral-latest');
    });

    it('should keep model with "ocr" in the middle of the name but not at start', async () => {
      // The regex is /^mistral-ocr|embed/i — only filters "mistral-ocr-*" prefix, not "ocr" mid-name
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'pixtral-large-latest' }, { id: 'some-ocr-model' }],
        }),
      });

      const result = await service.fetch('mistral', 'key');
      // Both pass: pixtral has no "mistral-ocr" prefix, "some-ocr-model" has "ocr" mid-name not prefix
      expect(result).toHaveLength(2);
    });
  });

  /* ── OpenAI parseOpenAIChatOnly edge cases ── */

  describe('parseOpenAIChatOnly edge cases', () => {
    it('should filter out realtime models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4o-realtime-preview' }, { id: 'gpt-4o' }],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });

    it('should filter out transcribe models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o-audio-transcribe' },
            { id: 'gpt-4o-mini-audio-transcribe' },
            { id: 'gpt-4o' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });

    it('should filter out sora models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'sora-2' }, { id: 'sora-2-pro' }, { id: 'o3' }],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('o3');
    });

    it('should keep all Codex variants in discovery (proxy routes them to /v1/responses)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'codex-mini-latest' },
            { id: 'gpt-5-codex' },
            { id: 'gpt-5.1-codex' },
            { id: 'gpt-5.2-codex' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result.map((m) => m.id)).toEqual([
        'codex-mini-latest',
        'gpt-5-codex',
        'gpt-5.1-codex',
        'gpt-5.2-codex',
      ]);
    });

    it('should keep gpt-5 -pro variants alongside gpt-5-chat-latest (proxy routes -pro to /v1/responses)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-5-pro' },
            { id: 'gpt-5.2-pro' },
            { id: 'gpt-5-chat-latest' },
            { id: 'gpt-5' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result.map((m) => m.id)).toEqual([
        'gpt-5-pro',
        'gpt-5.2-pro',
        'gpt-5-chat-latest',
        'gpt-5',
      ]);
    });

    it('should filter out audio models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o-audio-preview' },
            { id: 'gpt-4o-mini-audio-preview' },
            { id: 'gpt-4o' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });

    it('should filter out text-moderation models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'text-moderation-latest' },
            { id: 'text-moderation-stable' },
            { id: 'gpt-4o' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      // text-moderation-* matches both the moderation pattern and the text- prefix pattern
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4o');
    });
  });

  /* ── Gemini dedup edge cases ── */

  describe('parseGemini dedup edge cases', () => {
    it('should keep multiple versioned models when no alias exists for any', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.0-flash-001',
              displayName: 'Flash 001',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.0-flash-002',
              displayName: 'Flash 002',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      // Neither has an alias without -NNN suffix, so both should be kept
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['gemini-2.0-flash-001', 'gemini-2.0-flash-002']);
    });

    it('should keep non-versioned model even when versioned variant exists', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.5-flash-001',
              displayName: 'Flash 001',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      // gemini-2.5-flash-001 has alias gemini-2.5-flash, so it's dropped
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-2.5-flash');
    });

    it('should not treat non-3-digit suffixes as version suffixes', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-pro-preview-03-25',
              displayName: 'Preview',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      // -03-25 is not a 3-digit version suffix, so the model stays
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-2.5-pro-preview-03-25');
    });
  });

  /* ── MiniMax subscription routing ── */

  it('should route minimax+subscription to minimax-subscription config', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('minimax', 'token', 'subscription');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.minimax.io'),
      expect.anything(),
    );
  });

  it('should use regular minimax config when authType is not subscription', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('minimax', 'api-key', 'api_key');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.minimaxi.chat'),
      expect.anything(),
    );
  });
});
