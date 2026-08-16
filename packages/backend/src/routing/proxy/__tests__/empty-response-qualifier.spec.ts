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

/** SSE response whose stream never closes — used to exercise the timeout path. */
function neverEndingSseResponse(sse: string): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sse));
        // Intentionally never close the stream.
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

/** Anthropic Messages non-streaming response shape. */
function anthropicResponse(content: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content,
    model: 'claude-test',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

/** Anthropic Messages SSE stream event. */
function anthropicSseEvent(eventType: string, data: Record<string, unknown>): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Google Generate Content non-streaming response shape. */
function googleResponse(parts: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    candidates: [
      {
        content: { parts, role: 'model' },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  };
}

/** Google Generate Content SSE stream chunk. */
function googleSseChunk(parts: Array<Record<string, unknown>>): string {
  return `data: ${JSON.stringify({
    candidates: [{ content: { parts, role: 'model' }, index: 0 }],
  })}\n\n`;
}

/** OpenAI Responses API non-streaming response shape. */
function responsesResponse(output: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: 'resp_1',
    object: 'response',
    created_at: Date.now(),
    status: 'completed',
    model: 'gpt-5',
    output,
  };
}

/** OpenAI Responses API SSE event. */
function responsesSseEvent(eventType: string, data: Record<string, unknown>): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
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

    describe('Anthropic Messages native format', () => {
      it('passes through a response with text content', async () => {
        const body = anthropicResponse([{ type: 'text', text: 'Hello from Claude' }]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
        const parsed = await response.json();
        expect(parsed.content[0].text).toBe('Hello from Claude');
      });

      it('passes through a response with a tool_use block', async () => {
        const body = anthropicResponse([
          { type: 'tool_use', id: 'tool_1', name: 'search', input: { q: 'test' } },
        ]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
      });

      it('rewrites an empty content array into a 502', async () => {
        const body = anthropicResponse([]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

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

      it('rewrites a response with only empty text blocks into a 502', async () => {
        const body = anthropicResponse([{ type: 'text', text: '   ' }]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(502);
      });
    });

    describe('Google Generate Content native format', () => {
      it('passes through a response with text content', async () => {
        const body = googleResponse([{ text: 'Hello from Gemini' }]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
        const parsed = await response.json();
        expect(parsed.candidates[0].content.parts[0].text).toBe('Hello from Gemini');
      });

      it('passes through a response with a functionCall part', async () => {
        const body = googleResponse([{ functionCall: { name: 'search', args: { q: 'test' } } }]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
      });

      it('rewrites an empty candidates array into a 502', async () => {
        const body = { candidates: [] };
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(502);
      });

      it('rewrites a response with only empty text parts into a 502', async () => {
        const body = googleResponse([{ text: '   ' }]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(502);
      });

      it('ignores thought parts when checking for deliverable content', async () => {
        const body = googleResponse([{ text: 'thinking...', thought: true }]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(502);
      });

      it('handles the CodeAssist envelope shape', async () => {
        const body = { response: googleResponse([{ text: 'Hello' }]) };
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
      });
    });

    describe('OpenAI Responses API native format', () => {
      it('passes through a response with output_text content', async () => {
        const body = responsesResponse([
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Hello from Responses' }],
          },
        ]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
        const parsed = await response.json();
        expect(parsed.output[0].content[0].text).toBe('Hello from Responses');
      });

      it('passes through a response with a function_call item', async () => {
        const body = responsesResponse([
          { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'search', arguments: '{}' },
        ]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(200);
      });

      it('rewrites a response with empty output into a 502', async () => {
        const body = responsesResponse([]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

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

      it('rewrites a response with only empty output_text parts into a 502', async () => {
        const body = responsesResponse([
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            content: [{ type: 'output_text', text: '   ' }],
          },
        ]);
        const response = await qualifyEmptyResponse(jsonResponse(body));

        expect(response.status).toBe(502);
      });
    });

    it('passes through a non-streaming completion whose text contains a literal [DONE] token', async () => {
      // A valid non-streaming completion may legitimately contain `[DONE]` in
      // message text. It must not be misclassified as SSE and rewritten to 502.
      const body = chatCompletion('The process finished. [DONE]');
      const response = await qualifyEmptyResponse(jsonResponse(body));

      expect(response.status).toBe(200);
      const parsed = await response.json();
      expect(parsed.choices[0].message.content).toBe('The process finished. [DONE]');
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

    describe('Anthropic Messages native stream', () => {
      it('passes through a stream with a text_delta', async () => {
        const sse =
          anthropicSseEvent('message_start', {
            type: 'message_start',
            message: { id: 'msg_1', usage: {} },
          }) +
          anthropicSseEvent('content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }) +
          anthropicSseEvent('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello' },
          }) +
          anthropicSseEvent('message_stop', { type: 'message_stop' });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe(sse);
      });

      it('passes through a stream with a tool_use block', async () => {
        const sse =
          anthropicSseEvent('content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', id: 'tool_1', name: 'search', input: {} },
          }) + anthropicSseEvent('message_stop', { type: 'message_stop' });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
      });

      it('rewrites a stream with only empty text deltas into a 502', async () => {
        const sse =
          anthropicSseEvent('content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }) +
          anthropicSseEvent('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: '   ' },
          }) +
          anthropicSseEvent('message_stop', { type: 'message_stop' });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(502);
      });
    });

    describe('Google Generate Content native stream', () => {
      it('passes through a stream with text content', async () => {
        const sse = googleSseChunk([{ text: 'Hello' }]) + 'data: [DONE]\n\n';
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe(sse);
      });

      it('passes through a stream with a functionCall part', async () => {
        const sse =
          googleSseChunk([{ functionCall: { name: 'search', args: { q: 'test' } } }]) +
          'data: [DONE]\n\n';
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
      });

      it('rewrites a stream with only empty text parts into a 502', async () => {
        const sse = googleSseChunk([{ text: '   ' }]) + 'data: [DONE]\n\n';
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(502);
      });
    });

    describe('OpenAI Responses API native stream', () => {
      it('passes through a stream with an output_text delta', async () => {
        const sse =
          responsesSseEvent('response.created', { type: 'response.created' }) +
          responsesSseEvent('response.output_text.delta', {
            type: 'response.output_text.delta',
            delta: 'Hello',
          }) +
          responsesSseEvent('response.completed', {
            type: 'response.completed',
            response: { id: 'resp_1', output: [] },
          });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe(sse);
      });

      it('passes through a stream whose delta relies on the event: line only', async () => {
        // Responses API events may omit `type` inside the JSON payload and rely
        // entirely on the `event:` line (e.g. `data: {"delta":"hi"}` for
        // `event: response.output_text.delta`).
        const sse =
          responsesSseEvent('response.output_text.delta', { delta: 'Hi' }) +
          responsesSseEvent('response.completed', { response: { status: 'completed' } });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe(sse);
      });

      it('passes through a stream with a function_call output item', async () => {
        const sse =
          responsesSseEvent('response.output_item.added', {
            type: 'response.output_item.added',
            output_index: 0,
            item: { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'search' },
          }) + responsesSseEvent('response.completed', { type: 'response.completed' });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(200);
      });

      it('rewrites a stream with only noise events into a 502', async () => {
        const sse = responsesSseEvent('response.created', { type: 'response.created' });
        const response = await qualifyEmptyResponse(sseResponse(sse));

        expect(response.status).toBe(502);
      });
    });

    it('replays a stream whose final chunk ends mid-event with deliverable pending payloads', async () => {
      // The body ends with an unterminated SSE event. The final read reports
      // `done: true`, parser.flush() surfaces the pending payload, and the
      // qualifier must replay the buffered bytes through a live stream —
      // releaseLock() must not happen before the replay's reader.read().
      const sse =
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}';
      const response = await qualifyEmptyResponse(sseResponse(sse));

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe(sse);
    });

    describe('streaming detection', () => {
      it('treats a response as streaming when the request stream flag is true', async () => {
        // content-type is application/json but the request was stream: true
        const sse = chunk({ content: 'Hello' }) + 'data: [DONE]\n\n';
        const response = new Response(sse, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

        const result = await qualifyEmptyResponse(response, undefined, true);

        expect(result.status).toBe(200);
        await expect(result.text()).resolves.toBe(sse);
      });

      it('detects SSE framing when content-type is missing or mislabeled', async () => {
        // content-type is application/json but the body is SSE-framed
        const sse = chunk({ content: 'Hello' }) + 'data: [DONE]\n\n';
        const response = new Response(sse, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

        const result = await qualifyEmptyResponse(response);

        expect(result.status).toBe(200);
        await expect(result.text()).resolves.toBe(sse);
      });

      it('detects SSE framing with event: lines when content-type is mislabeled', async () => {
        const sse =
          anthropicSseEvent('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello' },
          }) + anthropicSseEvent('message_stop', { type: 'message_stop' });
        const response = new Response(sse, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

        const result = await qualifyEmptyResponse(response);

        expect(result.status).toBe(200);
        await expect(result.text()).resolves.toBe(sse);
      });
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

    it('stream timeout declares empty after timeout elapses', async () => {
      // Use the injectable timeout override — the module-level timeout is
      // captured at load time from the env, so mutating process.env here
      // would not affect qualifyEmptyResponse. The stream never closes so
      // the timeout path is exercised.
      const sse = 'data: :keepalive\n\n'; // SSE comment heartbeat that never counts as deliverable
      const response = neverEndingSseResponse(sse);

      const result = await qualifyEmptyResponse(response, 50);

      expect(result.status).toBe(502);
      await expect(result.json()).resolves.toEqual({
        error: {
          message: 'Provider streamed no content or tool calls before the timeout',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
      });
    });
  });
});
