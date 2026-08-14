import {
  buildCommandCodeChatRequest,
  buildCommandCodeHeaders,
  collectCommandCodeCompletion,
  commandCodeLineToOpenAiChunks,
  COMMAND_CODE_CHAT_URL,
  createCommandCodeOpenAiStream,
  forwardCommandCodeChat,
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
      },
    ]);
    expect(messages[1].role).toBe('tool');
    expect(messages[1].content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'call_1',
        toolName: '',
        output: '3 results',
      },
    ]);
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
});

describe('buildCommandCodeHeaders', () => {
  it('sends a fresh x-session-id per request', () => {
    const first = buildCommandCodeHeaders('user_test');
    const second = buildCommandCodeHeaders('user_test');
    expect(first['x-session-id']).toEqual(expect.any(String));
    expect(first['x-session-id']).not.toBe(second['x-session-id']);
  });
});
