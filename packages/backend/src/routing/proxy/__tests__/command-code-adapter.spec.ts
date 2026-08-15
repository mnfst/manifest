import {
  buildCommandCodeChatRequest,
  buildCommandCodeHeaders,
  collectCommandCodeCompletion,
  commandCodeErrorFromEvent,
  commandCodeLineToOpenAiChunks,
  COMMAND_CODE_CHAT_URL,
  createCommandCodeOpenAiStream,
  forwardCommandCodeChat,
  preflightCommandCodeStream,
} from '../command-code-adapter';

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

type Chunk = {
  object: string;
  id: string;
  model: string;
  choices: Array<{ index: number; delta: Record<string, unknown>; finish_reason: string | null }>;
  usage?: Record<string, unknown>;
};

function paramsOf(request: Record<string, unknown>): Record<string, unknown> {
  return (request.params as Record<string, unknown>) ?? {};
}

function chunkOf(line: string, state: unknown, model: string): Chunk | undefined {
  return (commandCodeLineToOpenAiChunks(line, state as never, model) ?? [])[0] as Chunk | undefined;
}

function ndjsonStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

describe('buildCommandCodeChatRequest', () => {
  it('lifts the system prompt to params.system and strips it from messages', () => {
    const request = buildCommandCodeChatRequest(
      {
        messages: [
          { role: 'system', content: 'You are a coding agent.' },
          { role: 'user', content: 'Fix the bug' },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      },
      'deepseek/deepseek-v4-flash',
    );

    expect(paramsOf(request)).toMatchObject({
      model: 'deepseek/deepseek-v4-flash',
      stream: true,
      system: 'You are a coding agent.',
      temperature: 0.7,
      max_tokens: 2048,
    });
    expect(paramsOf(request).messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
    ]);
    expect(request.threadId).toEqual(expect.any(String));
    expect(request.memory).toBe('');
    expect(request.config).toMatchObject({ date: expect.any(String) });
  });

  it('converts assistant tool_calls and tool results to Command Code blocks', () => {
    const request = buildCommandCodeChatRequest(
      {
        messages: [
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'search', arguments: '{"q":"manifest"}' },
              },
            ],
          },
          { role: 'tool', tool_call_id: 'call_1', content: '3 results' },
        ],
      },
      'claude-sonnet-4-6',
    );

    const messages = paramsOf(request).messages as Array<{ role: string; content: unknown[] }>;
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].content).toEqual([
      { type: 'text', text: '' },
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'search',
        input: { q: 'manifest' },
        arguments: '{"q":"manifest"}',
      },
    ]);
    expect(messages[1].role).toBe('tool');
    expect(messages[1].content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'call_1',
        toolName: 'search',
        arguments: '{"q":"manifest"}',
        output: { type: 'text', value: '3 results' },
      },
    ]);
  });

  it('renders tool-result output as the typed AI SDK v5 output shape', () => {
    // Regression: a bare-string output fails the upstream ModelMessage[]
    // validation ("The messages do not match the ModelMessage[] schema").
    const request = buildCommandCodeChatRequest(
      {
        messages: [
          {
            role: 'assistant',
            content: 'checking…',
            tool_calls: [
              {
                id: 'c9',
                type: 'function',
                function: { name: 'lookup', arguments: '{"id":7}' },
              },
            ],
          },
          { role: 'tool', tool_call_id: 'c9', name: 'lookup', content: 'found' },
        ],
      },
      'gpt-5.4',
    );

    const messages = paramsOf(request).messages as Array<{ role: string; content: unknown[] }>;
    const toolMessage = messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'c9',
        toolName: 'lookup',
        arguments: '{"id":7}',
        output: { type: 'text', value: 'found' },
      },
    ]);
  });

  it('closes an unpaired assistant tool call with an error-text tool-result', () => {
    const request = buildCommandCodeChatRequest(
      {
        messages: [
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call_orphan',
                type: 'function',
                function: { name: 'search', arguments: '{"q":"x"}' },
              },
            ],
          },
        ],
      },
      'claude-sonnet-4-6',
    );

    const messages = paramsOf(request).messages as Array<{ role: string; content: unknown[] }>;
    expect(messages[1].role).toBe('tool');
    expect(messages[1].content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'call_orphan',
        toolName: 'search',
        arguments: '{"q":"x"}',
        output: {
          type: 'error-text',
          value: expect.stringContaining('no tool result was recorded'),
        },
      },
    ]);
  });

  it('degrades a tool result without a matching assistant call to a user carrier', () => {
    const request = buildCommandCodeChatRequest(
      {
        messages: [{ role: 'tool', tool_call_id: 'ghost', name: 'grep', content: '2 hits' }],
      },
      'gpt-5.4',
    );

    const messages = paramsOf(request).messages as Array<{ role: string; content: unknown[] }>;
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('tool result without adjacent tool call: grep (ghost)'),
      },
    ]);
  });

  it('falls back to {} arguments for malformed tool-call arguments', () => {
    const request = buildCommandCodeChatRequest(
      {
        messages: [
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              { id: 'bad', type: 'function', function: { name: 'boom', arguments: 'not-json' } },
            ],
          },
          { role: 'tool', tool_call_id: 'bad', content: 'ok' },
        ],
      },
      'gpt-5.4',
    );

    const messages = paramsOf(request).messages as Array<{ role: string; content: unknown[] }>;
    const call = messages[0].content?.[1] as Record<string, unknown>;
    expect(call).toMatchObject({
      type: 'tool-call',
      toolCallId: 'bad',
      toolName: 'boom',
      input: {},
      arguments: '{}',
    });
  });

  it('converts OpenAI tools to Anthropic-shaped {name, description, input_schema}', () => {
    const request = buildCommandCodeChatRequest(
      {
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'lookup',
              description: 'Look things up',
              parameters: { type: 'object', properties: { q: { type: 'string' } } },
            },
          },
        ],
      },
      'gpt-5.4',
    );

    expect(paramsOf(request).tools).toEqual([
      {
        name: 'lookup',
        description: 'Look things up',
        input_schema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    ]);
  });
});

describe('commandCodeLineToOpenAiChunks', () => {
  it('translates text deltas into OpenAI SSE chunks', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };

    expect(chunkOf('{"type":"text-delta","text":"Hello"}', state, 'm')?.choices[0].delta).toEqual({
      role: 'assistant',
      content: 'Hello',
    });
    expect(chunkOf('{"type":"text-delta","text":" world"}', state, 'm')?.choices[0].delta).toEqual({
      content: ' world',
    });
    expect(chunkOf('{"type":"text-delta","text":"Hello"}', state, 'm')?.object).toBe(
      'chat.completion.chunk',
    );
  });

  it('maps reasoning deltas to reasoning_content', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };
    expect(
      chunkOf('{"type":"reasoning-delta","text":"thinking"}', state, 'm')?.choices[0].delta,
    ).toEqual({ role: 'assistant', reasoning_content: 'thinking' });
  });

  it('streams tool-input-start + tool-input-delta into accumulated tool_calls', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };

    expect(
      chunkOf('{"type":"tool-input-start","id":"t1","toolName":"search"}', state, 'm')?.choices[0]
        .delta,
    ).toMatchObject({
      tool_calls: [
        { index: 0, id: 't1', type: 'function', function: { name: 'search', arguments: '' } },
      ],
    });
    expect(
      chunkOf(
        '{"type":"tool-input-delta","id":"t1","delta":"{\\"q\\":\\"manifest\\"}"}',
        state,
        'm',
      )?.choices[0].delta,
    ).toEqual({
      tool_calls: [{ index: 0, function: { arguments: '{"q":"manifest"}' } }],
    });
  });

  it('emits a consolidated tool-call chunk when no input deltas preceded it', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };
    expect(
      chunkOf(
        '{"type":"tool-call","toolCallId":"c9","toolName":"search","input":{"q":"x"}}',
        state,
        'm',
      )?.choices[0].delta,
    ).toMatchObject({
      tool_calls: [
        {
          index: 0,
          id: 'c9',
          type: 'function',
          function: { name: 'search', arguments: '{"q":"x"}' },
        },
      ],
    });
  });

  it('maps finish + usage onto the final chunk', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };
    commandCodeLineToOpenAiChunks(
      '{"type":"finish-step","finishReason":"stop","usage":{"inputTokens":10,"outputTokens":5,"totalTokens":15}}',
      state,
      'm',
    );

    expect(
      chunkOf(
        '{"type":"finish","totalUsage":{"inputTokens":10,"outputTokens":5,"totalTokens":15}}',
        state,
        'm',
      )?.choices[0].finish_reason,
    ).toBe('stop');
    expect(
      chunkOf(
        '{"type":"finish","totalUsage":{"inputTokens":10,"outputTokens":5,"totalTokens":15}}',
        state,
        'm',
      )?.usage,
    ).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it('surfaces error events as content + stop', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };
    expect(
      chunkOf('{"type":"error","error":"model overloaded"}', state, 'm')?.choices[0].delta.content,
    ).toContain('CommandCode error');
    const errorChunks = commandCodeLineToOpenAiChunks(
      '{"type":"error","error":"model overloaded"}',
      state,
      'm',
    ) as unknown as Chunk[];
    expect(errorChunks[1]?.choices[0].finish_reason).toBe('stop');
  });

  it('ignores non-content events like start and text-start', () => {
    const state = {
      responseId: 'r1',
      created: 1,
      model: 'm',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };
    expect(commandCodeLineToOpenAiChunks('{"type":"start"}', state, 'm')).toBeNull();
    expect(commandCodeLineToOpenAiChunks('{"type":"text-start","id":"x"}', state, 'm')).toBeNull();
  });
});

describe('createCommandCodeOpenAiStream', () => {
  it('wraps NDJSON lines as OpenAI SSE and terminates with [DONE]', async () => {
    const stream = createCommandCodeOpenAiStream(
      ndjsonStream([
        '{"type":"text-delta","text":"Hi"}',
        '{"type":"finish-step","finishReason":"stop"}',
        '{"type":"finish"}',
      ]),
      'deepseek/deepseek-v4-flash',
    );

    const sse = await collectStream(stream);
    const dataLines = sse
      .split('\n\n')
      .filter(Boolean)
      .map((block) => block.replace(/^data: /, ''));

    expect(dataLines[0]).toContain('"content":"Hi"');
    expect(JSON.parse(dataLines[0]).model).toBe('deepseek/deepseek-v4-flash');
    expect(dataLines[dataLines.length - 1]).toBe('[DONE]');
  });

  it('tolerates a data: prefix on upstream lines', async () => {
    const stream = createCommandCodeOpenAiStream(
      ndjsonStream(['data: {"type":"text-delta","text":"p"}']),
      'm',
    );
    const sse = await collectStream(stream);
    expect(sse).toContain('"content":"p"');
  });
});

describe('collectCommandCodeCompletion', () => {
  it('assembles a non-streaming chat.completion with tool calls and usage', async () => {
    const completion = (await collectCommandCodeCompletion(
      ndjsonStream([
        '{"type":"text-delta","text":"Let me check."}',
        '{"type":"tool-input-start","id":"t1","toolName":"lookup"}',
        '{"type":"tool-input-delta","id":"t1","delta":"{\\"a\\":1}"}',
        '{"type":"finish-step","finishReason":"tool-calls"}',
        '{"type":"finish","totalUsage":{"inputTokens":7,"outputTokens":3,"totalTokens":10}}',
      ]),
      'gpt-5.4',
    )) as {
      object: string;
      choices: Array<{
        index: number;
        message: Record<string, unknown>;
        finish_reason: string | null;
      }>;
      usage?: Record<string, unknown>;
    };

    expect(completion.object).toBe('chat.completion');
    expect(completion.choices[0].message).toMatchObject({
      role: 'assistant',
      content: 'Let me check.',
      tool_calls: [
        {
          id: 't1',
          type: 'function',
          function: { name: 'lookup', arguments: '{"a":1}' },
        },
      ],
    });
    expect(completion.choices[0].finish_reason).toBe('tool_calls');
    expect(completion.usage).toEqual({
      prompt_tokens: 7,
      completion_tokens: 3,
      total_tokens: 10,
    });
  });
});

describe('commandCodeErrorFromEvent', () => {
  it('extracts the message from a nested server_error object', () => {
    expect(
      commandCodeErrorFromEvent({
        type: 'error',
        error: {
          type: 'server_error',
          message: 'Invalid prompt: The messages do not match the ModelMessage[] schema.',
        },
      }),
    ).toEqual({
      status: 502,
      message: 'Invalid prompt: The messages do not match the ModelMessage[] schema.',
    });
  });

  it('honors an explicit status and retry-after for rate limits', () => {
    expect(
      commandCodeErrorFromEvent({
        type: 'error',
        status: 429,
        'retry-after': '17',
        error: { message: 'Rate limited' },
      }),
    ).toEqual({ status: 429, message: 'Rate limited', retryAfter: '17' });
  });

  it('treats a rate-limit-shaped message without a status as 429', () => {
    expect(
      commandCodeErrorFromEvent({
        type: 'error',
        error: { message: 'Too many requests, slow down' },
      })?.status,
    ).toBe(429);
  });

  it('handles string error payloads', () => {
    expect(commandCodeErrorFromEvent({ type: 'error', error: 'model overloaded' })).toEqual({
      status: 502,
      message: 'model overloaded',
    });
  });

  it('treats finish/finish-step with finishReason error as a failure', () => {
    expect(commandCodeErrorFromEvent({ type: 'finish', finishReason: 'error' })).toEqual({
      status: 502,
      message: 'Command Code upstream finished with an error',
    });
  });

  it('returns null for non-error events', () => {
    expect(commandCodeErrorFromEvent({ type: 'start' })).toBeNull();
    expect(commandCodeErrorFromEvent({ type: 'text-delta', text: 'hi' })).toBeNull();
    expect(commandCodeErrorFromEvent({ type: 'finish', finishReason: 'stop' })).toBeNull();
  });
});

describe('preflightCommandCodeStream', () => {
  it('surfaces an error event that precedes any content', async () => {
    const { error } = await preflightCommandCodeStream(
      ndjsonStream([
        '{"type":"start"}',
        '{"type":"error","error":{"type":"server_error","message":"Invalid prompt: bad"}}',
      ]),
    );
    expect(error).toMatchObject({
      status: 502,
      message: expect.stringContaining('Invalid prompt'),
    });
  });

  it('passes a content-first stream through, replaying scanned lines', async () => {
    const { error, stream } = await preflightCommandCodeStream(
      ndjsonStream([
        '{"type":"start"}',
        '{"type":"text-delta","text":"Hi"}',
        '{"type":"finish"}',
      ]),
    );
    expect(error).toBeNull();
    const sse = await collectStream(createCommandCodeOpenAiStream(stream, 'm'));
    expect(sse).toContain('"content":"Hi"');
    expect(sse).toContain('data: [DONE]');
  });

  it('treats an immediate finish with error reason as a failure', async () => {
    const { error } = await preflightCommandCodeStream(
      ndjsonStream(['{"type":"start"}', '{"type":"finish","finishReason":"error"}']),
    );
    expect(error).not.toBeNull();
  });

  it('fails the request when the body read errors mid-scan', async () => {
    const encoder = new TextEncoder();
    const broken = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('{"type":"start"}\n'));
        controller.error(new Error('connection reset'));
      },
    });
    const { error } = await preflightCommandCodeStream(broken);
    expect(error).toMatchObject({ status: 502, message: 'connection reset' });
  });
});

describe('forwardCommandCodeChat', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('POSTs the translated envelope to /alpha/generate and returns OpenAI SSE', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: ndjsonStream(['{"type":"text-delta","text":"hi"}', '{"type":"finish"}']),
    });

    const response = await forwardCommandCodeChat({
      apiKey: 'user_test',
      model: 'deepseek/deepseek-v4-flash',
      body: { messages: [{ role: 'user', content: 'hi' }], stream: true },
      stream: true,
      timeoutMs: 5000,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      COMMAND_CODE_CHAT_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer user_test',
          'x-command-code-version': '0.25.7',
          'x-cli-environment': 'cli',
        }),
      }),
    );
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.params.model).toBe('deepseek/deepseek-v4-flash');
    expect(sentBody.params.stream).toBe(true);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const sse = await collectStream(response.body!);
    expect(sse).toContain('"content":"hi"');
    expect(sse).toContain('data: [DONE]');
  });

  it('collects the forced stream into a JSON completion for non-streaming callers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: ndjsonStream(['{"type":"text-delta","text":"answer"}', '{"type":"finish"}']),
    });

    const response = await forwardCommandCodeChat({
      apiKey: 'user_test',
      model: 'gpt-5.4',
      body: { messages: [{ role: 'user', content: 'q' }], stream: false },
      stream: false,
      timeoutMs: 5000,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    const completion = JSON.parse(await response.text());
    expect(completion.choices[0].message.content).toBe('answer');
    expect(completion.object).toBe('chat.completion');
  });

  it('passes a non-OK upstream response through untouched', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

    const response = await forwardCommandCodeChat({
      apiKey: 'user_bad',
      model: 'gpt-5.4',
      body: { messages: [] },
      stream: true,
      timeoutMs: 5000,
    });

    expect(response.status).toBe(401);
  });

  it('turns a streamed upstream error into a non-OK response (fallback-triggering)', async () => {
    // The ModelMessage[] schema rejection arrives over HTTP 200 as an error
    // event. It must surface as an error so the proxy can fall back to the
    // next model instead of streaming the error text as assistant output.
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: ndjsonStream([
        '{"type":"start"}',
        '{"type":"error","error":{"type":"server_error","message":"Invalid prompt: The messages do not match the ModelMessage[] schema."}}',
      ]),
    });

    const response = await forwardCommandCodeChat({
      apiKey: 'user_test',
      model: 'gpt-5.4',
      body: { messages: [{ role: 'user', content: 'hi' }], stream: true },
      stream: true,
      timeoutMs: 5000,
    });

    expect(response.status).toBe(502);
    const errorBody = (await response.json()) as { error: { message: string } };
    expect(errorBody.error.message).toContain('Invalid prompt');
  });

  it('maps a streamed rate-limit error to 429 with retry-after', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: ndjsonStream([
        '{"type":"start"}',
        '{"type":"error","error":{"status":429,"message":"Rate limited"},"retry-after":"30"}',
      ]),
    });

    const response = await forwardCommandCodeChat({
      apiKey: 'user_test',
      model: 'gpt-5.4',
      body: { messages: [{ role: 'user', content: 'hi' }], stream: true },
      stream: true,
      timeoutMs: 5000,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
  });

  it('turns a streamed error into a non-OK response for non-streaming callers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: ndjsonStream(['{"type":"error","error":{"message":"model overloaded"}}']),
    });

    const response = await forwardCommandCodeChat({
      apiKey: 'user_test',
      model: 'gpt-5.4',
      body: { messages: [{ role: 'user', content: 'q' }], stream: false },
      stream: false,
      timeoutMs: 5000,
    });

    expect(response.status).toBe(502);
  });
});

describe('buildCommandCodeHeaders', () => {
  it('sends a fresh x-session-id per request', () => {
    const first = buildCommandCodeHeaders('user_test');
    const second = buildCommandCodeHeaders('user_test');
    expect(first['x-session-id']).toEqual(expect.any(String));
    expect(first['x-session-id']).not.toBe(second['x-session-id']);
  });
});
