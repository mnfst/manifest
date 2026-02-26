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

    it('sets stream=true when streaming', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      await client.forward('openai', 'sk-test', 'gpt-4o', body, true);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.stream).toBe(true);
    });
  });

  describe('Google provider (OpenAI-compatible)', () => {
    it('uses Bearer auth and OpenAI-compatible path', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward(
        'google',
        'AIza-test',
        'gemini-2.0-flash',
        body,
        false,
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer AIza-test');

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('gemini-2.0-flash');
      expect(sentBody.stream).toBe(false);
    });

    it('sends OpenAI-format body for Google', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward('google', 'AIza-test', 'gemini-2.0-flash', body, false);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.model).toBe('gemini-2.0-flash');
      expect(sentBody.messages).toEqual(body.messages);
      expect(sentBody.temperature).toBe(0.7);
      // Should NOT have Google-native fields
      expect(sentBody.contents).toBeUndefined();
    });
  });

  describe('Provider aliases', () => {
    it('resolves gemini to google endpoint', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await client.forward(
        'gemini',
        'AIza-test',
        'gemini-2.0-flash',
        body,
        false,
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('generativelanguage.googleapis.com');
    });
  });

  describe('Error handling', () => {
    it('throws for unknown provider', async () => {
      await expect(
        client.forward('unknown-provider', 'key', 'model', body, false),
      ).rejects.toThrow('No endpoint configured for provider');
    });
  });
});
