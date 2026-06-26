import {
  createOpenAiChatCompletionStreamNormalizer,
  createOpenAiChatCompletionTerminalGuard,
} from '../openai-stream-normalizer';

function dataFrames(sseText: string): string[] {
  return sseText
    .trim()
    .split('\n\n')
    .map((frame) => frame.trim())
    .filter(Boolean);
}

function parseDataFrame(frame: string): unknown {
  expect(frame).toMatch(/^data: /);
  const payload = frame.slice('data: '.length);
  if (payload === '[DONE]') return payload;
  return JSON.parse(payload) as unknown;
}

describe('createOpenAiChatCompletionStreamNormalizer', () => {
  it('adds a terminal finish chunk before DONE when upstream only sends DONE', () => {
    const normalizer = createOpenAiChatCompletionStreamNormalizer('gpt-4o');

    const content = normalizer.transform(
      'data: {"id":"chunk-1","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":null}]}\n\n',
    );
    const done = normalizer.transform('data: [DONE]\n\n');
    const trailing = normalizer.finalize();

    expect(content).toContain('"content":"hi"');
    expect(done).toBeNull();
    expect(trailing).toContain('"finish_reason":"stop"');
    expect(trailing).toContain('data: [DONE]');

    const frames = dataFrames(`${content ?? ''}${trailing ?? ''}`);
    const parsed = frames.map(parseDataFrame);
    expect(parsed[parsed.length - 1]).toBe('[DONE]');
    const finalChunk = parsed[parsed.length - 2] as Record<string, unknown>;
    expect(finalChunk.object).toBe('chat.completion.chunk');
    const choices = finalChunk.choices as Array<Record<string, unknown>>;
    expect(choices[0].finish_reason).toBe('stop');
  });

  it('does not duplicate an upstream terminal finish chunk', () => {
    const normalizer = createOpenAiChatCompletionStreamNormalizer('gpt-4o');

    const terminal = normalizer.transform(
      'data: {"id":"chunk-2","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
    );
    const trailing = normalizer.finalize();

    expect(terminal).toContain('"finish_reason":"stop"');
    expect(trailing).toBe('data: [DONE]\n\n');
  });

  it('strips SSE metadata and emits valid JSON data frames', () => {
    const normalizer = createOpenAiChatCompletionStreamNormalizer('gpt-4o');

    const out = normalizer.transform(
      'event: completion.chunk\nid: evt_1\ndata: {"id":"chunk-3","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}\n\n',
    );

    expect(out).toBe(
      'data: {"id":"chunk-3","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}\n\n',
    );
    expect(() => JSON.parse(out!.trim().slice('data: '.length))).not.toThrow();
  });

  it('does not leak non-JSON upstream data frames', () => {
    const normalizer = createOpenAiChatCompletionStreamNormalizer('gpt-4o');

    const out = normalizer.transform('data: not-json\n\n');
    const trailing = normalizer.finalize();

    expect(out).toContain('"type":"upstream_error"');
    expect(out).not.toContain('data: not-json');
    expect(() => JSON.parse(out!.trim().slice('data: '.length))).not.toThrow();
    expect(trailing).toContain('"finish_reason":"stop"');
    expect(trailing).toContain('data: [DONE]');
  });
});

describe('createOpenAiChatCompletionTerminalGuard', () => {
  it('observes transformed chunks and appends a synthetic terminal chunk when missing', () => {
    const guard = createOpenAiChatCompletionTerminalGuard('claude-sonnet-4');

    const out = guard.transform(
      'data: {"id":"chunk-1","object":"chat.completion.chunk","model":"claude-sonnet-4","choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":null}]}\n\n',
    );
    const trailing = guard.finalize();

    expect(out).toContain('"content":"hi"');
    expect(trailing).toContain('"finish_reason":"stop"');
    expect(trailing).toContain('data: [DONE]');
  });

  it('observes transformed terminal chunks and only appends DONE', () => {
    const guard = createOpenAiChatCompletionTerminalGuard('claude-sonnet-4');

    guard.transform(
      'data: {"id":"chunk-2","object":"chat.completion.chunk","model":"claude-sonnet-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
    );

    expect(guard.finalize()).toBe('data: [DONE]\n\n');
  });
});
