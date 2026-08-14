import { Buffer } from 'node:buffer';
import {
  buildKiroChatRequest,
  buildKiroHeaders,
  createKiroOpenAiStream,
  forwardKiroChat,
  KIRO_BASE_URL,
  KIRO_CHAT_TARGET,
  KIRO_MODELS_TARGET,
  KiroEventStreamParser,
  parseKiroModels,
  toKiroModelId,
} from '../kiro-adapter';

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

function stringHeader(name: string, value: string): Buffer {
  const nameBytes = Buffer.from(name);
  const valueBytes = Buffer.from(value);
  const valueLength = Buffer.alloc(2);
  valueLength.writeUInt16BE(valueBytes.length, 0);
  return Buffer.concat([
    Buffer.from([nameBytes.length]),
    nameBytes,
    Buffer.from([7]),
    valueLength,
    valueBytes,
  ]);
}

function typedHeader(name: string, type: number, value: number | bigint | Buffer = 0): Buffer {
  const nameBytes = Buffer.from(name);
  if (type === 0 || type === 1) {
    return Buffer.concat([Buffer.from([nameBytes.length]), nameBytes, Buffer.from([type])]);
  }
  if (type === 2) {
    const valueBytes = Buffer.alloc(1);
    valueBytes.writeInt8(Number(value));
    return Buffer.concat([
      Buffer.from([nameBytes.length]),
      nameBytes,
      Buffer.from([type]),
      valueBytes,
    ]);
  }
  if (type === 3) {
    const valueBytes = Buffer.alloc(2);
    valueBytes.writeInt16BE(Number(value));
    return Buffer.concat([
      Buffer.from([nameBytes.length]),
      nameBytes,
      Buffer.from([type]),
      valueBytes,
    ]);
  }
  if (type === 4) {
    const valueBytes = Buffer.alloc(4);
    valueBytes.writeInt32BE(Number(value));
    return Buffer.concat([
      Buffer.from([nameBytes.length]),
      nameBytes,
      Buffer.from([type]),
      valueBytes,
    ]);
  }
  if (type === 5 || type === 8) {
    const valueBytes = Buffer.alloc(8);
    valueBytes.writeBigInt64BE(BigInt(value as number | bigint));
    return Buffer.concat([
      Buffer.from([nameBytes.length]),
      nameBytes,
      Buffer.from([type]),
      valueBytes,
    ]);
  }
  if (type === 6) {
    const valueBytes = Buffer.isBuffer(value) ? value : Buffer.from([Number(value)]);
    const valueLength = Buffer.alloc(2);
    valueLength.writeUInt16BE(valueBytes.length, 0);
    return Buffer.concat([
      Buffer.from([nameBytes.length]),
      nameBytes,
      Buffer.from([type]),
      valueLength,
      valueBytes,
    ]);
  }
  if (type === 9) {
    const valueBytes = Buffer.isBuffer(value)
      ? value
      : Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    return Buffer.concat([
      Buffer.from([nameBytes.length]),
      nameBytes,
      Buffer.from([type]),
      valueBytes,
    ]);
  }
  return Buffer.concat([Buffer.from([nameBytes.length]), nameBytes, Buffer.from([type])]);
}

function eventFrame(
  eventType: string,
  payload: unknown,
  messageType = 'event',
  extraHeaders: Buffer[] = [],
): Uint8Array {
  const headers = Buffer.concat([
    stringHeader(':message-type', messageType),
    stringHeader(':event-type', eventType),
    ...extraHeaders,
  ]);
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const totalLength = 12 + headers.length + payloadBytes.length + 4;
  const frame = Buffer.alloc(totalLength);
  frame.writeUInt32BE(totalLength, 0);
  frame.writeUInt32BE(headers.length, 4);
  headers.copy(frame, 12);
  payloadBytes.copy(frame, 12 + headers.length);
  return frame;
}

function streamFrom(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('kiro-adapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('builds Kiro AWS JSON headers', () => {
    expect(buildKiroHeaders('ksk_test', KIRO_MODELS_TARGET)).toEqual({
      Authorization: 'Bearer ksk_test',
      'Content-Type': 'application/x-amz-json-1.0',
      'x-amz-target': KIRO_MODELS_TARGET,
    });
  });

  it('parses Kiro model list responses into subscription model IDs', () => {
    const result = parseKiroModels({
      models: [
        {
          model_id: 'auto',
          model_name: 'auto',
          context_window_tokens: 1000000,
        },
        {
          modelId: 'claude-sonnet-4.5',
          modelName: 'Claude Sonnet 4.5',
          tokenLimits: { maxInputTokens: 200000 },
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'kiro/auto',
        displayName: 'auto',
        provider: 'kiro',
        contextWindow: 1000000,
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        capabilityCode: true,
      }),
      expect.objectContaining({
        id: 'kiro/claude-sonnet-4.5',
        displayName: 'Claude Sonnet 4.5',
        contextWindow: 200000,
      }),
    ]);
  });

  it('strips only the kiro vendor prefix before forwarding', () => {
    expect(toKiroModelId('kiro/auto')).toBe('auto');
    expect(toKiroModelId('claude-sonnet-4.5')).toBe('claude-sonnet-4.5');
  });

  it('converts OpenAI messages into a Kiro conversation request', () => {
    const request = buildKiroChatRequest(
      {
        messages: [
          { role: 'system', content: 'Use concise answers.' },
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'tool', tool_call_id: 'tool-1', content: { ok: true } },
          { role: 'user', content: [{ type: 'text', text: 'Second question' }] },
        ],
      },
      'auto',
    );

    expect(request).toMatchObject({
      conversationState: {
        history: [
          { userInputMessage: { content: 'First question', origin: 'KIRO_CLI' } },
          { assistantResponseMessage: { content: 'First answer' } },
          {
            userInputMessage: {
              content: 'Tool result tool-1:\n{"ok":true}',
              origin: 'KIRO_CLI',
            },
          },
        ],
        currentMessage: {
          userInputMessage: {
            content: 'System instructions:\nUse concise answers.\n\nUser:\nSecond question',
            origin: 'KIRO_CLI',
            modelId: 'auto',
          },
        },
        chatTriggerType: 'MANUAL',
      },
      agentMode: 'SUPERVISED',
    });
  });

  it('handles image parts, empty parts, and circular object content defensively', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const request = buildKiroChatRequest(
      {
        messages: [
          { role: 'user', content: [{ type: 'image_url' }, { type: 'unknown' }] },
          { role: 'assistant', content: null },
          { role: 'user', content: circular },
        ],
      },
      'auto',
    ) as {
      conversationState: {
        history: Array<{ userInputMessage?: { content: string } }>;
        currentMessage: { userInputMessage: { content: string } };
      };
    };

    expect(request.conversationState.history).toEqual([
      { userInputMessage: { content: '[image omitted]', origin: 'KIRO_CLI' } },
    ]);
    expect(request.conversationState.currentMessage.userInputMessage.content).toBe(
      '[object Object]',
    );
  });

  it('parses split AWS event-stream frames', () => {
    const frame = eventFrame('assistantResponseEvent', { content: 'hello' });
    const parser = new KiroEventStreamParser();

    expect(parser.push(frame.subarray(0, 8))).toEqual([]);
    expect(parser.push(frame.subarray(8))).toEqual([
      {
        eventType: 'assistantResponseEvent',
        messageType: 'event',
        payload: { content: 'hello' },
      },
    ]);
    expect(() => parser.finish()).not.toThrow();
  });

  it('parses supported AWS event-stream headers and rejects malformed frames', () => {
    const parser = new KiroEventStreamParser();
    expect(
      parser.push(
        eventFrame('assistantResponseEvent', { content: 'hello' }, 'event', [
          typedHeader('bool', 0),
          typedHeader('byte', 2, -1),
          typedHeader('short', 3, 7),
          typedHeader('int', 4, 42),
          typedHeader('long', 5, 42n),
          typedHeader('bytes', 6, Buffer.from([1, 2, 3])),
          typedHeader('timestamp', 8, 1700000000000n),
          typedHeader('uuid', 9),
        ]),
      )[0],
    ).toEqual({
      eventType: 'assistantResponseEvent',
      messageType: 'event',
      payload: { content: 'hello' },
    });

    const invalidLength = Buffer.alloc(12);
    invalidLength.writeUInt32BE(15, 0);
    expect(() => new KiroEventStreamParser().push(invalidLength)).toThrow(
      'Invalid Kiro event stream frame',
    );
  });

  it('keeps parsing the payload when Kiro sends an unknown event-stream header type', () => {
    const parser = new KiroEventStreamParser();

    expect(
      parser.push(
        eventFrame('assistantResponseEvent', { content: 'hello' }, 'event', [
          typedHeader('unsupported', 10),
        ]),
      )[0],
    ).toEqual({
      eventType: 'assistantResponseEvent',
      messageType: 'event',
      payload: { content: 'hello' },
    });
  });

  it('unwraps nested Kiro event payloads', async () => {
    const response = new Response(
      createKiroOpenAiStream(
        streamFrom([
          eventFrame('assistantResponseEvent', {
            assistantResponseEvent: { content: 'wrapped' },
          }),
        ]),
        'auto',
      ),
    );

    await expect(response.text()).resolves.toContain('"content":"wrapped"');
  });

  it('surfaces Kiro exception events from streaming responses', async () => {
    const response = new Response(
      createKiroOpenAiStream(
        streamFrom([eventFrame('accessDeniedException', { message: 'denied' }, 'exception')]),
        'auto',
      ),
    );

    await expect(response.text()).rejects.toThrow('denied');
  });

  it('converts Kiro event-stream output to OpenAI SSE chunks', async () => {
    const source = streamFrom([
      eventFrame('reasoningContentEvent', { text: 'thinking' }),
      eventFrame('assistantResponseEvent', { content: 'hello' }),
      eventFrame('metadataEvent', {
        tokenUsage: {
          uncachedInputTokens: 4,
          cacheReadInputTokens: 1,
          cacheWriteInputTokens: 2,
          outputTokens: 3,
          totalTokens: 10,
        },
      }),
    ]);

    const response = new Response(createKiroOpenAiStream(source, 'auto'));
    const text = await response.text();

    expect(text).toContain('"reasoning_content":"thinking"');
    expect(text).toContain('"content":"hello"');
    expect(text).toContain('"finish_reason":"stop"');
    expect(text).toContain('"prompt_tokens":7');
    expect(text).toContain('data: [DONE]');
  });

  it('forwards streaming Kiro chat as OpenAI-compatible SSE', async () => {
    mockFetch.mockResolvedValue(
      new Response(streamFrom([eventFrame('assistantResponseEvent', { content: 'hello' })]), {
        status: 200,
      }),
    );

    const response = await forwardKiroChat({
      apiKey: 'ksk_test',
      model: 'auto',
      body: { messages: [{ role: 'user', content: 'Hello' }] },
      stream: true,
      timeoutMs: 1000,
      extraHeaders: { 'x-extra': '1' },
    });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(mockFetch.mock.calls[0][1].headers['x-extra']).toBe('1');
    expect(await response.text()).toContain('"content":"hello"');
  });

  it('forwards non-streaming Kiro chat and returns OpenAI-compatible JSON', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        streamFrom([
          eventFrame('assistantResponseEvent', { content: 'hel' }),
          eventFrame('assistantResponseEvent', { content: 'lo' }),
          eventFrame('metadataEvent', {
            tokenUsage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          }),
        ]),
        { status: 200 },
      ),
    );

    const response = await forwardKiroChat({
      apiKey: 'ksk_test',
      model: 'auto',
      body: { messages: [{ role: 'user', content: 'Hello' }] },
      stream: false,
      timeoutMs: 1000,
    });
    const json = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      KIRO_BASE_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ksk_test',
          'x-amz-target': KIRO_CHAT_TARGET,
          'x-amzn-kiro-agent-mode': 'SUPERVISED',
        }),
      }),
    );
    expect(json).toMatchObject({
      object: 'chat.completion',
      model: 'auto',
      choices: [{ message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    });
  });

  it('passes upstream Kiro errors through unchanged', async () => {
    mockFetch.mockResolvedValue(new Response('forbidden', { status: 403 }));

    const response = await forwardKiroChat({
      apiKey: 'ksk_bad',
      model: 'auto',
      body: { messages: [{ role: 'user', content: 'Hello' }] },
      stream: false,
      timeoutMs: 1000,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('forbidden');
  });
});
