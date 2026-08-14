import {
  DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS,
  parseEmptyResponseTimeoutMs,
  qualifyEmptyResponse,
} from '../empty-response-qualifier';

function jsonResponse(body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function sseResponse(sse: string, headers?: Record<string, string>): Response {
  return new Response(sse, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', ...headers },
  });
}

function chunkedSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
        else controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

function chatCompletion(content: string | null, toolCalls?: unknown[]): Record<string, unknown> {
  const message: Record<string, unknown> = { role: 'assistant', content };
  if (toolCalls) message.tool_calls = toolCalls;
  return {
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: Date.now(),
    model: 'test-model',
    choices: [{ index: 0, message, finish_reason: 'stop' }],
  };
}

function chunk(delta: Record<string, unknown>): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'test-model',
    choices: [{ index: 0, delta, finish_reason: null }],
  })}\n\n`;
}

describe('qualifyEmptyResponse', () => {
  describe('non-streaming', () => {
    it('passes through a response with real content', async () => {
      const response = await qualifyEmptyResponse(jsonResponse(chatCompletion('Hello world')));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.choices[0].message.content).toBe('Hello world');
      expect(body.choices[0].message.role).toBe('assistant');
      expect(body.model).toBe('test-model');
    });

    it('passes through a response with tool calls and empty content', async () => {
      const body = chatCompletion('', [
        { id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } },
      ]);
      const response = await qualifyEmptyResponse(jsonResponse(body));

      expect(response.status).toBe(200);
      const parsed = await response.json();
      expect(parsed.choices[0].message.content).toBe('');
      expect(parsed.choices[0].message.tool_calls).toHaveLength(1);
    });

    it('rewrites an empty content response into a 502', async () => {
      const response = await qualifyEmptyResponse(jsonResponse(chatCompletion('')));

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: {
          message: 'Provider returned a chat completion without content or tool calls',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
        raw_body: expect.any(String),
      });
    });

    it('rewrites a null content response into a 502', async () => {
      const response = await qualifyEmptyResponse(jsonResponse(chatCompletion(null)));

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: {
          message: 'Provider returned a chat completion without content or tool calls',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
        raw_body: expect.any(String),
      });
    });

    it('rewrites an empty choices array into a 502', async () => {
      const response = await qualifyEmptyResponse(
        jsonResponse({ id: 'x', object: 'chat.completion', choices: [] }),
      );

      expect(response.status).toBe(502);
    });

    it('rewrites an empty body into a 502', async () => {
      const response = await qualifyEmptyResponse(
        new Response('', { status: 200, headers: { 'content-type': 'application/json' } }),
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: {
          message: 'Provider returned an empty response body',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
      });
    });

    it('passes through non-200 responses untouched', async () => {
      const response = await qualifyEmptyResponse(
        new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: 'boom' });
    });
  });

  describe('streaming', () => {
    it('passes through a stream with a content delta', async () => {
      const sse = chunk({ role: 'assistant' }) + chunk({ content: 'Hello' }) + 'data: [DONE]\n\n';
      const response = await qualifyEmptyResponse(sseResponse(sse));

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe(sse);
    });

    it('passes through a stream with a tool call delta', async () => {
      const sse =
        chunk({ role: 'assistant' }) +
        chunk({
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'search', arguments: '' },
            },
          ],
        }) +
        'data: [DONE]\n\n';
      const response = await qualifyEmptyResponse(sseResponse(sse));

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe(sse);
    });

    it('rewrites a stream with only role deltas into a 502', async () => {
      const sse = chunk({ role: 'assistant' }) + 'data: [DONE]\n\n';
      const response = await qualifyEmptyResponse(sseResponse(sse));

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: {
          message: 'Provider stream ended without content or tool calls',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
      });
    });

    it('rewrites an empty stream into a 502', async () => {
      const response = await qualifyEmptyResponse(sseResponse(''));

      expect(response.status).toBe(502);
    });

    it('replays buffered chunks when a later chunk is deliverable', async () => {
      const first = chunk({ role: 'assistant' });
      const second = chunk({ content: 'Hello' });
      const response = await qualifyEmptyResponse(chunkedSseResponse([first, second]));

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe(first + second);
    });
  });

  describe('parseEmptyResponseTimeoutMs', () => {
    it('returns the default for missing or invalid values', () => {
      expect(parseEmptyResponseTimeoutMs('')).toBe(DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS);
      expect(parseEmptyResponseTimeoutMs('abc')).toBe(DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS);
      expect(parseEmptyResponseTimeoutMs('-1')).toBe(DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS);
      expect(parseEmptyResponseTimeoutMs('0')).toBe(DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS);
    });

    it('parses a valid value', () => {
      expect(parseEmptyResponseTimeoutMs('30000')).toBe(30_000);
    });
  });
});
