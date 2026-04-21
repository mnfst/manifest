import { ProviderClient } from '../provider-client';

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

describe('ProviderClient', () => {
  let client: ProviderClient;

  beforeEach(() => {
    client = new ProviderClient();
    mockFetch.mockReset();
  });

  const body = {
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.7,
  };

  describe('OpenAI-compatible providers', () => {
    it('builds correct URL and headers for openai', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer sk-test',
            'Content-Type': 'application/json',
          },
        }),
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('gpt-4o');
      expect(sentBody.stream).toBe(false);
      expect(sentBody.temperature).toBe(0.7);
      expect(result.isAnthropic).toBe(false);
    });

    it('builds correct URL for deepseek', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const result = await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-chat',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.any(Object),
      );
      expect(result.isAnthropic).toBe(false);
    });

    it('builds correct URL for mistral', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-large-latest',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for moonshot', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'moonshot',
        apiKey: 'sk-moon',
        model: 'kimi-k2',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.moonshot.ai/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for qwen', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'qwen',
        apiKey: 'sk-qwen',
        model: 'qwen3-235b-a22b',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer sk-qwen',
            'Content-Type': 'application/json',
          },
        }),
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('qwen3-235b-a22b');
      expect(sentBody.stream).toBe(false);
    });

    it('builds correct URL for xai', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'xai',
        apiKey: 'sk-xai',
        model: 'grok-3',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for openrouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or-test',
        model: 'openrouter/auto',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer sk-or-test',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://manifest.build',
            'X-Title': 'Manifest',
          },
        }),
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('openrouter/auto');
    });

    it('sets stream=true when streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBe(true);
    });
  });

  describe('Anthropic provider', () => {
    it('uses native Messages API path and x-api-key header', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
        model: 'claude-sonnet-4-20250514',
        body,
        stream: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'x-api-key': 'sk-ant-test',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
        }),
      );

      expect(result.isAnthropic).toBe(true);
      expect(result.isGoogle).toBe(false);
    });

    it('does not include anthropic-beta header (caching is GA)', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
        model: 'claude-sonnet-4-20250514',
        body,
        stream: false,
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['anthropic-beta']).toBeUndefined();
    });

    it('does not include top-level cache_control in Anthropic request body', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant',
        model: 'claude-sonnet-4-20250514',
        body,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.cache_control).toBeUndefined();
    });

    it('converts request body to Anthropic format with model', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant',
        model: 'claude-sonnet-4-20250514',
        body,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('claude-sonnet-4-20250514');
      expect(sentBody.messages).toBeDefined();
      expect(sentBody.max_tokens).toBeDefined();
      // toAnthropicRequest correctly maps temperature from the original body
      expect(sentBody.temperature).toBe(0.7);
    });

    it('sets stream=true in body when streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant',
        model: 'claude-sonnet-4-20250514',
        body,
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBe(true);
    });

    it('does not set stream when not streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant',
        model: 'claude-sonnet-4-20250514',
        body,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBeUndefined();
    });

    it('omits cache_control from request body for subscription auth', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        tools: [{ type: 'function', function: { name: 'search', description: 'Search' } }],
      };

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant-oat-token',
        model: 'claude-sonnet-4-20250514',
        body: bodyWithSystem,
        stream: false,
        authType: 'subscription',
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.cache_control).toBeUndefined();
      const system = sentBody.system as Array<{ text?: string; cache_control?: unknown }>;
      // First system block is the subscription identity prompt
      expect(system[0].text).toContain('Claude agent');
      expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
      // User system block has no cache_control (subscription skips caching)
      expect(system[1].cache_control).toBeUndefined();
      const tools = sentBody.tools as Array<{ cache_control?: unknown }>;
      expect(tools[0].cache_control).toBeUndefined();
    });

    it('includes block-level cache_control for regular Anthropic API key auth', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        tools: [{ type: 'function', function: { name: 'search', description: 'Search' } }],
      };

      await client.forward({
        provider: 'anthropic',
        apiKey: 'sk-ant-key',
        model: 'claude-sonnet-4-20250514',
        body: bodyWithSystem,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.cache_control).toBeUndefined();
      const system = sentBody.system as Array<{ cache_control?: unknown }>;
      expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
      const tools = sentBody.tools as Array<{ cache_control?: unknown }>;
      expect(tools[0].cache_control).toEqual({ type: 'ephemeral' });
    });
  });

  describe('Google provider', () => {
    it('uses query param auth and Gemini path', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'google',
        apiKey: 'AIza-test',
        model: 'gemini-2.0-flash',
        body,
        stream: false,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('gemini-2.0-flash:generateContent');
      expect(url).toContain('key=AIza-test');
      expect(url).not.toContain('alt=sse');
      expect(result.isGoogle).toBe(true);
      expect(result.isAnthropic).toBe(false);
    });

    it('adds alt=sse for streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'google',
        apiKey: 'AIza-test',
        model: 'gemini-2.0-flash',
        body,
        stream: true,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('alt=sse');
    });

    it('converts request body to Gemini format', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'google',
        apiKey: 'AIza-test',
        model: 'gemini-2.0-flash',
        body,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.contents).toBeDefined();
      // Should not have OpenAI-style fields
      expect(sentBody.model).toBeUndefined();
      expect(sentBody.stream).toBeUndefined();
    });
  });

  describe('ChatGPT subscription provider', () => {
    it('routes to chatgpt.com Codex backend with subscription authType', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'openai',
        apiKey: 'oauth-token',
        model: 'gpt-5',
        body,
        stream: false,
        authType: 'subscription',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://chatgpt.com/backend-api/codex/responses');
      expect(result.isChatGpt).toBe(true);
      expect(result.isGoogle).toBe(false);
      expect(result.isAnthropic).toBe(false);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['originator']).toBe('codex_cli_rs');
      expect(headers['Authorization']).toBe('Bearer oauth-token');
    });

    it('converts request body using toResponsesRequest', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'Be helpful.' },
          { role: 'user', content: 'Hello' },
        ],
      };
      await client.forward({
        provider: 'openai',
        apiKey: 'token',
        model: 'gpt-5.3-codex',
        body: bodyWithSystem,
        stream: false,
        authType: 'subscription',
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.instructions).toBe('Be helpful.');
      expect(sentBody.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
      ]);
      expect(sentBody.model).toBe('gpt-5.3-codex');
      expect(sentBody.stream).toBe(true);
      expect(sentBody.store).toBe(false);
    });

    it('sends default instructions when no system or developer prompt is present', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'token',
        model: 'gpt-5.1-codex-mini',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: false,
        authType: 'subscription',
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.instructions).toBe('You are a helpful assistant.');
    });

    it('sets isChatGpt=false for regular OpenAI api_key auth', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
      });

      expect(result.isChatGpt).toBe(false);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('api.openai.com');
    });
  });

  describe('Z.ai subscription provider', () => {
    it('routes to Coding Plan endpoint with subscription authType', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'zai',
        apiKey: 'zai-sub-key',
        model: 'glm-5.1',
        body,
        stream: false,
        authType: 'subscription',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer zai-sub-key');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('routes to standard Z.ai endpoint for api_key auth', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'zai',
        apiKey: 'zai-key',
        model: 'glm-4.7',
        body,
        stream: false,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://api.z.ai/api/paas/v4/chat/completions');
    });
  });

  describe('OpenCode Go provider', () => {
    it('routes non-minimax models to OpenAI /v1/chat/completions', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'opencode-go',
        apiKey: 'og-token',
        model: 'opencode-go/glm-5.1',
        body,
        stream: false,
        authType: 'subscription',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://opencode.ai/zen/go/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer og-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Model prefix is stripped before forwarding
      expect(sentBody.model).toBe('glm-5.1');
      expect(result.isAnthropic).toBe(false);
      expect(result.isChatGpt).toBe(false);
    });

    it('routes minimax-* models to Anthropic /v1/messages', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'opencode-go',
        apiKey: 'og-token',
        model: 'opencode-go/minimax-m2.7',
        body,
        stream: false,
        authType: 'subscription',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://opencode.ai/zen/go/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'og-token',
            'anthropic-version': '2023-06-01',
          }),
        }),
      );
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('minimax-m2.7');
      expect(result.isAnthropic).toBe(true);
    });

    it('also routes minimax-m2.5 to the Anthropic endpoint', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'opencode-go',
        apiKey: 'og-token',
        model: 'opencode-go/minimax-m2.5',
        body,
        stream: false,
        authType: 'subscription',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://opencode.ai/zen/go/v1/messages');
    });

    it('routes kimi-k2.5 through the OpenAI endpoint', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'opencode-go',
        apiKey: 'og-token',
        model: 'opencode-go/kimi-k2.5',
        body,
        stream: false,
        authType: 'subscription',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('kimi-k2.5');
    });
  });

  describe('convertChatGptResponse', () => {
    it('delegates to fromResponsesResponse', () => {
      const data = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello' }],
          },
        ],
        usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      };
      const result = client.convertChatGptResponse(data, 'gpt-5');

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gpt-5');
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('Hello');
    });
  });

  describe('convertChatGptStreamChunk', () => {
    it('converts output_text delta to chat completion chunk', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"delta":"Hi"}';
      const result = client.convertChatGptStreamChunk(chunk, 'gpt-5');

      expect(result).toContain('data: ');
      expect(result).toContain('"chat.completion.chunk"');
    });

    it('returns null for irrelevant events', () => {
      const result = client.convertChatGptStreamChunk('event: response.created\ndata: {}', 'gpt-5');
      expect(result).toBeNull();
    });
  });

  describe('OpenRouter Anthropic cache injection', () => {
    it('injects cache_control for anthropic/ models on openrouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'anthropic/claude-sonnet-4-20250514',
        body: bodyWithSystem,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const sysMsg = sentBody.messages[0];
      expect(Array.isArray(sysMsg.content)).toBe(true);
      expect(sysMsg.content[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('does not inject cache_control for non-anthropic models on openrouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'openai/gpt-4o',
        body: bodyWithSystem,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(typeof sentBody.messages[0].content).toBe('string');
    });
  });

  describe('Extra headers', () => {
    it('merges extraHeaders into outgoing request', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'xai',
        apiKey: 'sk-xai',
        model: 'grok-3',
        body,
        stream: false,
        extraHeaders: { 'x-grok-conv-id': 'session-123' },
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers['x-grok-conv-id']).toBe('session-123');
    });

    it('does not override base headers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        extraHeaders: { 'X-Custom': 'value' },
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers['Authorization']).toBe('Bearer sk-test');
      expect(fetchOptions.headers['X-Custom']).toBe('value');
    });
  });

  describe('Provider aliases', () => {
    it('resolves gemini to google endpoint', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward({
        provider: 'gemini',
        apiKey: 'AIza-test',
        model: 'gemini-2.0-flash',
        body,
        stream: false,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(result.isGoogle).toBe(true);
    });
  });

  describe('AbortSignal passthrough', () => {
    it('uses timeout signal when no client signal provided', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
      expect(fetchOptions.signal.aborted).toBe(false);
    });

    it('combines client signal with timeout signal', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const abortController = new AbortController();
      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        signal: abortController.signal,
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
      expect(fetchOptions.signal.aborted).toBe(false);

      // Aborting the client signal should abort the combined signal
      abortController.abort();
      expect(fetchOptions.signal.aborted).toBe(true);
    });

    it('passes already-aborted signal correctly', async () => {
      const abortController = new AbortController();
      abortController.abort();

      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        signal: abortController.signal,
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal.aborted).toBe(true);
    });

    it('always provides a signal to fetch even without client signal', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
      // The signal should be the timeout signal (not undefined)
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });

    it('provides signal for Google provider as well', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const ac = new AbortController();
      await client.forward({
        provider: 'google',
        apiKey: 'AIza-test',
        model: 'gemini-2.0-flash',
        body,
        stream: false,
        signal: ac.signal,
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
      expect(fetchOptions.signal.aborted).toBe(false);

      ac.abort();
      expect(fetchOptions.signal.aborted).toBe(true);
    });
  });

  describe('convertGoogleResponse', () => {
    it('delegates to fromGoogleResponse', () => {
      const googleBody = {
        candidates: [
          {
            content: { parts: [{ text: 'Hello' }] },
            finishReason: 'STOP',
          },
        ],
      };
      const result = client.convertGoogleResponse(googleBody, 'gemini-2.0-flash');

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gemini-2.0-flash');
      const choices = result.choices as Array<{ message: { content: string } }>;
      expect(choices[0].message.content).toBe('Hello');
    });
  });

  describe('convertGoogleStreamChunk', () => {
    it('delegates to transformGoogleStreamChunk', () => {
      const chunk = JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: 'Hi' }] },
          },
        ],
      });
      const result = client.convertGoogleStreamChunk(chunk, 'gemini-2.0-flash');

      expect(result.chunk).toContain('data: ');
      expect(result.chunk).toContain('"chat.completion.chunk"');
      expect(result.signatures).toEqual([]);
    });

    it('returns null chunk for empty input', () => {
      const result = client.convertGoogleStreamChunk('', 'gemini-2.0-flash');
      expect(result.chunk).toBeNull();
      expect(result.signatures).toEqual([]);
    });

    it('surfaces extracted signatures from functionCall parts', () => {
      const chunk = JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: { name: 'fn', args: {} },
                  thoughtSignature: 'sig_abc',
                },
              ],
            },
          },
        ],
      });
      const result = client.convertGoogleStreamChunk(chunk, 'gemini-3-pro-preview');
      expect(result.signatures).toHaveLength(1);
      expect(result.signatures[0].signature).toBe('sig_abc');
    });
  });

  describe('convertAnthropicResponse', () => {
    it('delegates to fromAnthropicResponse', () => {
      const anthropicBody = {
        content: [{ type: 'text', text: 'Hello' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      const result = client.convertAnthropicResponse(anthropicBody, 'claude-sonnet-4-20250514');

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ message: { content: string } }>;
      expect(choices[0].message.content).toBe('Hello');
    });
  });

  describe('convertAnthropicStreamChunk', () => {
    it('delegates to transformAnthropicStreamChunk', () => {
      const chunk =
        'event: content_block_delta\n{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
      const result = client.convertAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');

      expect(result).toContain('data: ');
      expect(result).toContain('"chat.completion.chunk"');
    });

    it('returns null for ping chunk', () => {
      const result = client.convertAnthropicStreamChunk(
        'event: ping\n{"type":"ping"}',
        'claude-sonnet-4-20250514',
      );
      expect(result).toBeNull();
    });
  });

  describe('createAnthropicStreamTransformer', () => {
    it('creates a stateful transformer that processes Anthropic stream events', () => {
      const transformer = client.createAnthropicStreamTransformer('claude-sonnet-4-20250514');
      expect(typeof transformer).toBe('function');

      // Test with a message_start event
      const startChunk =
        'event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":10}}}';
      const result = transformer(startChunk);
      expect(result).toContain('data: ');
      expect(result).toContain('"role":"assistant"');
    });
  });

  describe('URL masking', () => {
    it('masks API key in Google URL for debug logging', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      // Spy on the logger to verify the masked URL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const debugSpy = jest.spyOn((client as any).logger, 'debug');

      await client.forward({
        provider: 'google',
        apiKey: 'AIzaSyABCDEF12345',
        model: 'gemini-2.0-flash',
        body,
        stream: false,
      });

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('key=***'));
      expect(debugSpy).toHaveBeenCalledWith(expect.not.stringContaining('AIzaSyABCDEF12345'));

      debugSpy.mockRestore();
    });
  });

  describe('Request body construction', () => {
    it('includes model and stream in request body for OpenAI providers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('gpt-4o');
      expect(sentBody.stream).toBe(true);
      expect(sentBody.messages).toEqual(body.messages);
      expect(sentBody.temperature).toBe(0.7);
    });

    it('does not include model or stream for Google provider (uses Gemini format)', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'google',
        apiKey: 'AIza-test',
        model: 'gemini-2.0-flash',
        body,
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBeUndefined();
      expect(sentBody.stream).toBeUndefined();
      expect(sentBody.contents).toBeDefined();
    });
  });

  describe('Vendor prefix stripping', () => {
    it('strips vendor prefix for non-OpenRouter providers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'anthropic/claude-sonnet-4',
        body,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('claude-sonnet-4');
    });

    it('preserves vendor prefix for OpenRouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'anthropic/claude-sonnet-4',
        body,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('anthropic/claude-sonnet-4');
    });
  });

  describe('Body sanitization for non-OpenAI providers', () => {
    const bodyWithOpenAiFields = {
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7,
      store: false,
      max_completion_tokens: 8192,
      metadata: { user: 'test' },
      service_tier: 'default',
      stream_options: { include_usage: true },
    };
    const makeBodyWithReasoningContent = () => ({
      messages: [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: 'Hi',
          reasoning_content: 'Detailed internal reasoning',
        },
      ],
      temperature: 0.7,
    });

    it('strips OpenAI-only fields for Mistral', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithOpenAiFields,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBeUndefined();
      expect(sentBody.metadata).toBeUndefined();
      expect(sentBody.service_tier).toBeUndefined();
      expect(sentBody.stream_options).toBeUndefined();
      expect(sentBody.messages).toEqual(bodyWithOpenAiFields.messages);
      expect(sentBody.temperature).toBe(0.7);
    });

    it('converts max_completion_tokens to max_tokens for non-OpenAI providers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithOpenAiFields,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_completion_tokens).toBeUndefined();
      expect(sentBody.max_tokens).toBe(8192);
    });

    it('does not overwrite existing max_tokens when converting', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithBoth = { ...bodyWithOpenAiFields, max_tokens: 4096 };
      await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-chat',
        body: bodyWithBoth,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBe(4096);
      expect(sentBody.max_completion_tokens).toBeUndefined();
    });

    it('strips OpenAI-only fields for DeepSeek', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-chat',
        body: bodyWithOpenAiFields,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBeUndefined();
      expect(sentBody.service_tier).toBeUndefined();
    });

    it('caps DeepSeek max_tokens at the provider limit', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-chat',
        body: { ...bodyWithOpenAiFields, max_tokens: 12000 },
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBe(8192);
    });

    it('drops non-positive DeepSeek max_tokens values', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-chat',
        body: { ...bodyWithOpenAiFields, max_tokens: 0 },
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBeUndefined();
    });

    it('normalizes string DeepSeek max_tokens values', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-chat',
        body: { ...bodyWithOpenAiFields, max_tokens: '9000' as unknown as number },
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBe(8192);
    });

    it('strips reasoning_content for Mistral assistant messages without mutating the input', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithReasoningContent,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
      expect(bodyWithReasoningContent.messages[1].reasoning_content).toBe(
        'Detailed internal reasoning',
      );
    });

    it('preserves reasoning_content for DeepSeek reasoning models', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward({
        provider: 'deepseek',
        apiKey: 'sk-ds',
        model: 'deepseek-reasoner',
        body: bodyWithReasoningContent,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBe('Detailed internal reasoning');
    });

    it('strips reasoning_content for native OpenAI targets', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body: bodyWithReasoningContent,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
    });

    it('strips reasoning_content for non-DeepSeek OpenRouter targets', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'openai/gpt-4o',
        body: bodyWithReasoningContent,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
    });

    it('preserves reasoning_content for DeepSeek models on OpenRouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'deepseek/deepseek-r1',
        body: bodyWithReasoningContent,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBe('Detailed internal reasoning');
    });

    it('leaves non-array messages unchanged during sanitization', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithNonArrayMessages = {
        messages: { role: 'assistant', reasoning_content: 'Detailed internal reasoning' },
        temperature: 0.7,
      };

      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithNonArrayMessages as unknown as Record<string, unknown>,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages).toEqual(bodyWithNonArrayMessages.messages);
    });

    it('preserves non-object entries inside the messages array', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithMixedMessages = {
        messages: [
          'unexpected-entry',
          { role: 'assistant', reasoning_content: 'Detailed internal reasoning' },
        ],
        temperature: 0.7,
      };

      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithMixedMessages as unknown as Record<string, unknown>,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[0]).toBe('unexpected-entry');
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
    });

    it('normalizes non-compliant tool call ids for Mistral while preserving references', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const originalToolCallId = 'call005AKQn2j5TEr4S6i3zNN59moT';
      const bodyWithToolCalls = {
        messages: [
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: originalToolCallId,
                type: 'function',
                function: { name: 'search', arguments: '{}' },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: originalToolCallId,
            content: '{"status":"ok"}',
          },
        ],
      };

      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithToolCalls as unknown as Record<string, unknown>,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const normalizedToolCallId = sentBody.messages[0].tool_calls[0].id;
      expect(normalizedToolCallId).toMatch(/^[A-Za-z0-9]{9}$/);
      expect(normalizedToolCallId).not.toBe(originalToolCallId);
      expect(sentBody.messages[1].tool_call_id).toBe(normalizedToolCallId);
      const originalAssistantMessage = bodyWithToolCalls.messages[0] as {
        tool_calls: Array<{ id: string }>;
      };
      expect(originalAssistantMessage.tool_calls[0].id).toBe(originalToolCallId);
      expect(bodyWithToolCalls.messages[1].tool_call_id).toBe(originalToolCallId);
    });

    it('preserves valid 9-character alphanumeric tool call ids for Mistral', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const validToolCallId = 'Ab12Cd34E';
      const bodyWithValidToolCallId = {
        messages: [
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: validToolCallId,
                type: 'function',
                function: { name: 'search', arguments: '{}' },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: validToolCallId,
            content: '{"status":"ok"}',
          },
        ],
      };

      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithValidToolCallId as unknown as Record<string, unknown>,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[0].tool_calls[0].id).toBe(validToolCallId);
      expect(sentBody.messages[1].tool_call_id).toBe(validToolCallId);
    });

    it('does not rewrite later valid Mistral tool call ids when generated ids would collide', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const invalidToolCallId = 'call005AKQn2j5TEr4S6i3zNN59moT';
      const validToolCallId = 'tc0000001';
      const bodyWithPotentialCollision = {
        messages: [
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: invalidToolCallId,
                type: 'function',
                function: { name: 'search', arguments: '{}' },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: invalidToolCallId,
            content: '{"status":"invalid"}',
          },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: validToolCallId,
                type: 'function',
                function: { name: 'lookup', arguments: '{}' },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: validToolCallId,
            content: '{"status":"valid"}',
          },
        ],
      };

      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: bodyWithPotentialCollision as unknown as Record<string, unknown>,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const normalizedInvalidId = sentBody.messages[0].tool_calls[0].id;
      expect(normalizedInvalidId).toMatch(/^[A-Za-z0-9]{9}$/);
      expect(normalizedInvalidId).not.toBe(validToolCallId);
      expect(sentBody.messages[1].tool_call_id).toBe(normalizedInvalidId);
      expect(sentBody.messages[2].tool_calls[0].id).toBe(validToolCallId);
      expect(sentBody.messages[3].tool_call_id).toBe(validToolCallId);
    });

    it('preserves all fields for OpenAI', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body: bodyWithOpenAiFields,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBe(false);
      expect(sentBody.max_completion_tokens).toBe(8192);
      expect(sentBody.metadata).toEqual({ user: 'test' });
    });

    it('preserves all fields for OpenRouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'openai/gpt-4o',
        body: bodyWithOpenAiFields,
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBe(false);
      expect(sentBody.max_completion_tokens).toBe(8192);
    });
  });

  describe('stream_options.include_usage injection', () => {
    it('injects stream_options.include_usage for OpenAI streaming requests', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toEqual({ include_usage: true });
    });

    it('injects stream_options.include_usage for OpenRouter streaming requests', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'openai/gpt-4o',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toEqual({ include_usage: true });
    });

    it('injects stream_options.include_usage for Ollama streaming requests', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'ollama',
        apiKey: '',
        model: 'llama3',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toEqual({ include_usage: true });
    });

    it('injects stream_options.include_usage for Ollama Cloud streaming requests', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'ollama-cloud',
        apiKey: 'ollama-key',
        model: 'llama3',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toEqual({ include_usage: true });
    });

    it('does not inject stream_options for non-streaming OpenAI requests', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: false,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toBeUndefined();
    });

    it('does not inject stream_options for non-passthrough providers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'mistral',
        apiKey: 'sk-mi',
        model: 'mistral-small',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toBeUndefined();
    });

    it('preserves existing stream_options fields when injecting include_usage', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
          stream_options: { some_field: 'value' },
        },
        stream: true,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream_options).toEqual({
        some_field: 'value',
        include_usage: true,
      });
    });
  });

  describe('Custom endpoint', () => {
    it('uses custom endpoint instead of resolving by provider name', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const customEndpoint = {
        baseUrl: 'https://api.groq.com/openai/v1',
        buildHeaders: (key: string) => ({
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        }),
        buildPath: () => '/v1/chat/completions',
        format: 'openai' as const,
      };

      const result = await client.forward({
        provider: 'custom:abc-123',
        apiKey: 'gsk_test',
        model: 'llama-3.1-70b',
        body,
        stream: false,
        customEndpoint,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://api.groq.com/openai/v1/v1/chat/completions');
      expect(result.isGoogle).toBe(false);
      expect(result.isAnthropic).toBe(false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('llama-3.1-70b');
      expect(sentBody.stream).toBe(false);
    });

    it('uses custom endpoint with streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const customEndpoint = {
        baseUrl: 'http://localhost:8000',
        buildHeaders: (key: string) => ({
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        }),
        buildPath: () => '/v1/chat/completions',
        format: 'openai' as const,
      };

      await client.forward({
        provider: 'custom:uuid',
        apiKey: '',
        model: 'my-model',
        body,
        stream: true,
        customEndpoint,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBe(true);
    });

    it('merges extraHeaders with custom endpoint headers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const customEndpoint = {
        baseUrl: 'http://localhost:8000',
        buildHeaders: (key: string) => ({
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        }),
        buildPath: () => '/v1/chat/completions',
        format: 'openai' as const,
      };

      await client.forward({
        provider: 'custom:uuid',
        apiKey: 'test-key',
        model: 'model',
        body,
        stream: false,
        extraHeaders: { 'X-Custom': 'value' },
        customEndpoint,
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers['Authorization']).toBe('Bearer test-key');
      expect(fetchOptions.headers['X-Custom']).toBe('value');
    });

    // Regression: #1591 — MiniMax endpoint rejects bare model name because the
    // second "/" segment was being eaten before reaching the provider.
    it('preserves multi-segment upstream model ids with a vendor/model shape (#1591)', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const customEndpoint = {
        baseUrl: 'https://api.minimax.io/v1',
        buildHeaders: (key: string) => ({
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        }),
        buildPath: () => '/chat/completions',
        format: 'openai' as const,
      };

      await client.forward({
        provider: 'custom:minimax-cp',
        apiKey: 'test-key',
        model: 'MiniMaxAI/MiniMax-2.7',
        body,
        stream: false,
        customEndpoint,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('MiniMaxAI/MiniMax-2.7');
    });

    // Regression: #1615 — Fireworks Fire Pass rejects truncated model name
    // because earlier code stripped the "accounts/" segment off the wire payload.
    it('preserves deeply slashed upstream model ids (#1615)', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const customEndpoint = {
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        buildHeaders: (key: string) => ({
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        }),
        buildPath: () => '/chat/completions',
        format: 'openai' as const,
      };

      await client.forward({
        provider: 'custom:fireworks-cp',
        apiKey: 'test-key',
        model: 'accounts/fireworks/routers/kimi-k2p5-turbo',
        body,
        stream: false,
        customEndpoint,
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('accounts/fireworks/routers/kimi-k2p5-turbo');
    });
  });

  describe('Error handling', () => {
    it('throws for unknown provider', async () => {
      await expect(
        client.forward({
          provider: 'unknown-provider',
          apiKey: 'key',
          model: 'model',
          body,
          stream: false,
        }),
      ).rejects.toThrow('No endpoint configured for provider');
    });

    it('propagates fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        client.forward({
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          body,
          stream: false,
        }),
      ).rejects.toThrow('Network error');
    });

    it('sanitizes Google API key from fetch error messages', async () => {
      mockFetch.mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com key=AIzaSySecret123'),
      );

      await expect(
        client.forward({
          provider: 'google',
          apiKey: 'AIzaSySecret123',
          model: 'gemini-2.0-flash',
          body,
          stream: false,
        }),
      ).rejects.toThrow('key=***');

      // Verify the secret key is NOT in the error
      try {
        await client.forward({
          provider: 'google',
          apiKey: 'AIzaSySecret123',
          model: 'gemini-2.0-flash',
          body,
          stream: false,
        });
      } catch (err) {
        expect((err as Error).message).not.toContain('AIzaSySecret123');
      }
    });

    it('sanitizes non-Error fetch exceptions', async () => {
      mockFetch.mockRejectedValue('key=LEAKED_SECRET fetch failed');

      await expect(
        client.forward({
          provider: 'google',
          apiKey: 'LEAKED_SECRET',
          model: 'gemini-2.0-flash',
          body,
          stream: false,
        }),
      ).rejects.toThrow('key=***');
    });
  });
});
