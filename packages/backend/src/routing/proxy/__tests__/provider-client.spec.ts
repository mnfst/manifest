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

      await client.forward('openai', 'sk-test', 'gpt-4o', body, false);

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
    });

    it('builds correct URL for anthropic', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('anthropic', 'sk-ant', 'claude-sonnet-4', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for deepseek', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('deepseek', 'sk-ds', 'deepseek-chat', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for mistral', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('mistral', 'sk-mi', 'mistral-large', body, false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('builds correct URL for xai', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('xai', 'sk-xai', 'grok-2', body, false);

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

  describe('Google provider', () => {
    it('uses query param auth and Gemini path', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward(
        'google',
        'AIza-test',
        'gemini-2.0-flash',
        body,
        false,
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('gemini-2.0-flash:generateContent');
      expect(url).toContain('key=AIza-test');
      expect(url).not.toContain('alt=sse');
      expect(result.isGoogle).toBe(true);
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

  describe('Provider aliases', () => {
    it('resolves gemini to google endpoint', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      const result = await client.forward(
        'gemini',
        'AIza-test',
        'gemini-2.0-flash',
        body,
        false,
      );

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
        candidates: [{
          content: { parts: [{ text: 'Hello' }] },
          finishReason: 'STOP',
        }],
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
        candidates: [{
          content: { parts: [{ text: 'Hi' }] },
        }],
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

  describe('URL masking', () => {
    it('masks API key in Google URL for debug logging', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      // Spy on the logger to verify the masked URL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const debugSpy = jest.spyOn((client as any).logger, 'debug');

      await client.forward('google', 'AIzaSyABCDEF12345', 'gemini-2.0-flash', body, false);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('key=***'),
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('AIzaSyABCDEF12345'),
      );

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

  describe('Error handling', () => {
    it('throws for unknown provider', async () => {
      await expect(
        client.forward('unknown-provider', 'key', 'model', body, false),
      ).rejects.toThrow('No endpoint configured for provider');
    });

    it('propagates fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        client.forward('openai', 'sk-test', 'gpt-4o', body, false),
      ).rejects.toThrow('Network error');
    });
  });
});
