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

      const result = await client.forward('openai', 'sk-test', 'gpt-4o', body, false);

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
      const result = await client.forward('deepseek', 'sk-ds', 'deepseek-chat', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.any(Object),
      );
      expect(result.isAnthropic).toBe(false);
    });

    it('builds correct URL for mistral', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('mistral', 'sk-mi', 'mistral-large-latest', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for moonshot', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('moonshot', 'sk-moon', 'kimi-k2', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.moonshot.cn/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for qwen', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('qwen', 'sk-qwen', 'qwen3-235b-a22b', body, false);

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
      await client.forward('xai', 'sk-xai', 'grok-3', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for openrouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('openrouter', 'sk-or-test', 'openrouter/auto', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer sk-or-test',
            'Content-Type': 'application/json',
          },
        }),
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('openrouter/auto');
    });

    it('sets stream=true when streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('openai', 'sk-test', 'gpt-4o', body, true);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBe(true);
    });
  });

  describe('Anthropic provider', () => {
    it('uses native Messages API path and x-api-key header', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward(
        'anthropic',
        'sk-ant-test',
        'claude-sonnet-4-20250514',
        body,
        false,
      );

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

      await client.forward('anthropic', 'sk-ant-test', 'claude-sonnet-4-20250514', body, false);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['anthropic-beta']).toBeUndefined();
    });

    it('includes top-level cache_control in Anthropic request body', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('anthropic', 'sk-ant', 'claude-sonnet-4-20250514', body, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('converts request body to Anthropic format with model', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('anthropic', 'sk-ant', 'claude-sonnet-4-20250514', body, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('claude-sonnet-4-20250514');
      expect(sentBody.messages).toBeDefined();
      expect(sentBody.max_tokens).toBeDefined();
      // toAnthropicRequest correctly maps temperature from the original body
      expect(sentBody.temperature).toBe(0.7);
    });

    it('sets stream=true in body when streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('anthropic', 'sk-ant', 'claude-sonnet-4-20250514', body, true);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBe(true);
    });

    it('does not set stream when not streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('anthropic', 'sk-ant', 'claude-sonnet-4-20250514', body, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBeUndefined();
    });
  });

  describe('Google provider', () => {
    it('uses query param auth and Gemini path', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward('google', 'AIza-test', 'gemini-2.0-flash', body, false);

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

      await client.forward('google', 'AIza-test', 'gemini-2.0-flash', body, true);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('alt=sse');
    });

    it('converts request body to Gemini format', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('google', 'AIza-test', 'gemini-2.0-flash', body, false);

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

      const result = await client.forward(
        'openai',
        'oauth-token',
        'gpt-5',
        body,
        false,
        undefined,
        undefined,
        undefined,
        'subscription',
      );

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
      await client.forward(
        'openai',
        'token',
        'gpt-5.3-codex',
        bodyWithSystem,
        false,
        undefined,
        undefined,
        undefined,
        'subscription',
      );

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

      await client.forward(
        'openai',
        'token',
        'gpt-5.1-codex-mini',
        { messages: [{ role: 'user', content: 'Hello' }] },
        false,
        undefined,
        undefined,
        undefined,
        'subscription',
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.instructions).toBe('You are a helpful assistant.');
    });

    it('sets isChatGpt=false for regular OpenAI api_key auth', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward('openai', 'sk-test', 'gpt-4o', body, false);

      expect(result.isChatGpt).toBe(false);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('api.openai.com');
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
      await client.forward(
        'openrouter',
        'sk-or',
        'anthropic/claude-sonnet-4-20250514',
        bodyWithSystem,
        false,
      );

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
      await client.forward('openrouter', 'sk-or', 'openai/gpt-4o', bodyWithSystem, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(typeof sentBody.messages[0].content).toBe('string');
    });
  });

  describe('Extra headers', () => {
    it('merges extraHeaders into outgoing request', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('xai', 'sk-xai', 'grok-3', body, false, undefined, {
        'x-grok-conv-id': 'session-123',
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers['x-grok-conv-id']).toBe('session-123');
    });

    it('does not override base headers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('openai', 'sk-test', 'gpt-4o', body, false, undefined, {
        'X-Custom': 'value',
      });

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers['Authorization']).toBe('Bearer sk-test');
      expect(fetchOptions.headers['X-Custom']).toBe('value');
    });
  });

  describe('Provider aliases', () => {
    it('resolves gemini to google endpoint', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward('gemini', 'AIza-test', 'gemini-2.0-flash', body, false);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(result.isGoogle).toBe(true);
    });
  });

  describe('AbortSignal passthrough', () => {
    it('uses timeout signal when no client signal provided', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('openai', 'sk-test', 'gpt-4o', body, false);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
      expect(fetchOptions.signal.aborted).toBe(false);
    });

    it('combines client signal with timeout signal', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const abortController = new AbortController();
      await client.forward('openai', 'sk-test', 'gpt-4o', body, false, abortController.signal);

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

      await client.forward('openai', 'sk-test', 'gpt-4o', body, false, abortController.signal);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal.aborted).toBe(true);
    });

    it('always provides a signal to fetch even without client signal', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('openai', 'sk-test', 'gpt-4o', body, false);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
      // The signal should be the timeout signal (not undefined)
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });

    it('provides signal for Google provider as well', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const ac = new AbortController();
      await client.forward('google', 'AIza-test', 'gemini-2.0-flash', body, false, ac.signal);

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

      expect(result).toContain('data: ');
      expect(result).toContain('"chat.completion.chunk"');
    });

    it('returns null for empty chunk', () => {
      const result = client.convertGoogleStreamChunk('', 'gemini-2.0-flash');
      expect(result).toBeNull();
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

      await client.forward('google', 'AIzaSyABCDEF12345', 'gemini-2.0-flash', body, false);

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('key=***'));
      expect(debugSpy).toHaveBeenCalledWith(expect.not.stringContaining('AIzaSyABCDEF12345'));

      debugSpy.mockRestore();
    });
  });

  describe('Request body construction', () => {
    it('includes model and stream in request body for OpenAI providers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('openai', 'sk-test', 'gpt-4o', body, true);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('gpt-4o');
      expect(sentBody.stream).toBe(true);
      expect(sentBody.messages).toEqual(body.messages);
      expect(sentBody.temperature).toBe(0.7);
    });

    it('does not include model or stream for Google provider (uses Gemini format)', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('google', 'AIza-test', 'gemini-2.0-flash', body, true);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBeUndefined();
      expect(sentBody.stream).toBeUndefined();
      expect(sentBody.contents).toBeDefined();
    });
  });

  describe('Vendor prefix stripping', () => {
    it('strips vendor prefix for non-OpenRouter providers', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('openai', 'sk-test', 'anthropic/claude-sonnet-4', body, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('claude-sonnet-4');
    });

    it('preserves vendor prefix for OpenRouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('openrouter', 'sk-or', 'anthropic/claude-sonnet-4', body, false);

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
      await client.forward('mistral', 'sk-mi', 'mistral-small', bodyWithOpenAiFields, false);

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
      await client.forward('mistral', 'sk-mi', 'mistral-small', bodyWithOpenAiFields, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_completion_tokens).toBeUndefined();
      expect(sentBody.max_tokens).toBe(8192);
    });

    it('does not overwrite existing max_tokens when converting', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithBoth = { ...bodyWithOpenAiFields, max_tokens: 4096 };
      await client.forward('deepseek', 'sk-ds', 'deepseek-chat', bodyWithBoth, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBe(4096);
      expect(sentBody.max_completion_tokens).toBeUndefined();
    });

    it('strips OpenAI-only fields for DeepSeek', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('deepseek', 'sk-ds', 'deepseek-chat', bodyWithOpenAiFields, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBeUndefined();
      expect(sentBody.service_tier).toBeUndefined();
    });

    it('caps DeepSeek max_tokens at the provider limit', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward(
        'deepseek',
        'sk-ds',
        'deepseek-chat',
        { ...bodyWithOpenAiFields, max_tokens: 12000 },
        false,
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBe(8192);
    });

    it('drops non-positive DeepSeek max_tokens values', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward(
        'deepseek',
        'sk-ds',
        'deepseek-chat',
        { ...bodyWithOpenAiFields, max_tokens: 0 },
        false,
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBeUndefined();
    });

    it('normalizes string DeepSeek max_tokens values', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward(
        'deepseek',
        'sk-ds',
        'deepseek-chat',
        { ...bodyWithOpenAiFields, max_tokens: '9000' as unknown as number },
        false,
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.max_tokens).toBe(8192);
    });

    it('strips reasoning_content for Mistral assistant messages without mutating the input', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward('mistral', 'sk-mi', 'mistral-small', bodyWithReasoningContent, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
      expect(bodyWithReasoningContent.messages[1].reasoning_content).toBe(
        'Detailed internal reasoning',
      );
    });

    it('preserves reasoning_content for DeepSeek reasoning models', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward(
        'deepseek',
        'sk-ds',
        'deepseek-reasoner',
        bodyWithReasoningContent,
        false,
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBe('Detailed internal reasoning');
    });

    it('strips reasoning_content for native OpenAI targets', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward('openai', 'sk-test', 'gpt-4o', bodyWithReasoningContent, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
    });

    it('strips reasoning_content for non-DeepSeek OpenRouter targets', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward('openrouter', 'sk-or', 'openai/gpt-4o', bodyWithReasoningContent, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
    });

    it('preserves reasoning_content for DeepSeek models on OpenRouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithReasoningContent = makeBodyWithReasoningContent();

      await client.forward(
        'openrouter',
        'sk-or',
        'deepseek/deepseek-r1',
        bodyWithReasoningContent,
        false,
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[1].reasoning_content).toBe('Detailed internal reasoning');
    });

    it('leaves non-array messages unchanged during sanitization', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const bodyWithNonArrayMessages = {
        messages: { role: 'assistant', reasoning_content: 'Detailed internal reasoning' },
        temperature: 0.7,
      };

      await client.forward(
        'mistral',
        'sk-mi',
        'mistral-small',
        bodyWithNonArrayMessages as unknown as Record<string, unknown>,
        false,
      );

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

      await client.forward(
        'mistral',
        'sk-mi',
        'mistral-small',
        bodyWithMixedMessages as unknown as Record<string, unknown>,
        false,
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messages[0]).toBe('unexpected-entry');
      expect(sentBody.messages[1].reasoning_content).toBeUndefined();
    });

    it('preserves all fields for OpenAI', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('openai', 'sk-test', 'gpt-4o', bodyWithOpenAiFields, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBe(false);
      expect(sentBody.max_completion_tokens).toBe(8192);
      expect(sentBody.metadata).toEqual({ user: 'test' });
    });

    it('preserves all fields for OpenRouter', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('openrouter', 'sk-or', 'openai/gpt-4o', bodyWithOpenAiFields, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.store).toBe(false);
      expect(sentBody.max_completion_tokens).toBe(8192);
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

      const result = await client.forward(
        'custom:abc-123',
        'gsk_test',
        'llama-3.1-70b',
        body,
        false,
        undefined,
        undefined,
        customEndpoint,
      );

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

      await client.forward(
        'custom:uuid',
        '',
        'my-model',
        body,
        true,
        undefined,
        undefined,
        customEndpoint,
      );

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

      await client.forward(
        'custom:uuid',
        'test-key',
        'model',
        body,
        false,
        undefined,
        { 'X-Custom': 'value' },
        customEndpoint,
      );

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers['Authorization']).toBe('Bearer test-key');
      expect(fetchOptions.headers['X-Custom']).toBe('value');
    });
  });

  describe('Error handling', () => {
    it('throws for unknown provider', async () => {
      await expect(client.forward('unknown-provider', 'key', 'model', body, false)).rejects.toThrow(
        'No endpoint configured for provider',
      );
    });

    it('propagates fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.forward('openai', 'sk-test', 'gpt-4o', body, false)).rejects.toThrow(
        'Network error',
      );
    });
  });
});
