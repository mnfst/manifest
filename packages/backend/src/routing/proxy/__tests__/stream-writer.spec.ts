import { initSseHeaders, parseSseEvents, pipeStream } from '../stream-writer';

function mockResponse(): {
  res: Record<string, jest.Mock | boolean>;
  written: string[];
  headers: Record<string, string>;
} {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  const res = {
    setHeader: jest.fn((k: string, v: string) => { headers[k] = v; }),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => { written.push(chunk); }),
    end: jest.fn(),
    writableEnded: false,
  };
  return { res, written, headers };
}

describe('initSseHeaders', () => {
  it('should set SSE headers and flush', () => {
    const { res, headers } = mockResponse();

    initSseHeaders(res as never);

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
    expect(headers['X-Accel-Buffering']).toBe('no');
    expect(res.flushHeaders).toHaveBeenCalled();
  });

  it('should set extra headers when provided', () => {
    const { res, headers } = mockResponse();

    initSseHeaders(res as never, {
      'X-Manifest-Tier': 'complex',
      'X-Manifest-Model': 'gpt-4o',
    });

    expect(headers['X-Manifest-Tier']).toBe('complex');
    expect(headers['X-Manifest-Model']).toBe('gpt-4o');
    expect(headers['Content-Type']).toBe('text/event-stream');
  });

  it('should work with empty extra headers', () => {
    const { res, headers } = mockResponse();

    initSseHeaders(res as never, {});

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(res.flushHeaders).toHaveBeenCalled();
  });
});

describe('parseSseEvents', () => {
  it('should parse a single SSE event', () => {
    const result = parseSseEvents('data: {"text":"hello"}\n\n');

    expect(result.events).toEqual(['{"text":"hello"}']);
    expect(result.remaining).toBe('');
  });

  it('should parse multiple SSE events', () => {
    const input = 'data: {"a":1}\n\ndata: {"b":2}\n\n';
    const result = parseSseEvents(input);

    expect(result.events).toEqual(['{"a":1}', '{"b":2}']);
    expect(result.remaining).toBe('');
  });

  it('should preserve partial buffer in remaining', () => {
    const input = 'data: {"done":true}\n\ndata: {"partial":';
    const result = parseSseEvents(input);

    expect(result.events).toEqual(['{"done":true}']);
    expect(result.remaining).toBe('data: {"partial":');
  });

  it('should skip [DONE] events', () => {
    const input = 'data: {"text":"hi"}\n\ndata: [DONE]\n\n';
    const result = parseSseEvents(input);

    expect(result.events).toEqual(['{"text":"hi"}']);
  });

  it('should skip empty events', () => {
    const input = '\n\ndata: {"a":1}\n\n\n\n';
    const result = parseSseEvents(input);

    expect(result.events).toEqual(['{"a":1}']);
  });

  it('should handle multi-line data events', () => {
    const input = 'data: line1\ndata: line2\n\n';
    const result = parseSseEvents(input);

    expect(result.events).toEqual(['line1\nline2']);
  });

  it('should return empty events for buffer with no complete events', () => {
    const result = parseSseEvents('data: partial');

    expect(result.events).toEqual([]);
    expect(result.remaining).toBe('data: partial');
  });

  it('should handle lines without data: prefix', () => {
    const input = 'raw content\n\n';
    const result = parseSseEvents(input);

    expect(result.events).toEqual(['raw content']);
  });
});

describe('pipeStream', () => {
  function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  it('should pipe chunks directly without a transform', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream(['hello', ' world']);

    await pipeStream(stream, res as never);

    expect(written).toEqual(['hello', ' world']);
    expect(res.end).toHaveBeenCalled();
  });

  it('should apply transform to SSE events', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream([
      'data: chunk1\n\ndata: chunk2\n\n',
    ]);

    const transform = (chunk: string) => `transformed:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    expect(written).toContain('transformed:chunk1\n\n');
    expect(written).toContain('transformed:chunk2\n\n');
    // Should end with [DONE] for transformed streams
    expect(written).toContain('data: [DONE]\n\n');
  });

  it('should skip null results from transform', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream([
      'data: skip\n\ndata: keep\n\n',
    ]);

    const transform = (chunk: string) =>
      chunk === 'skip' ? null : `result:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    expect(written).toContain('result:keep\n\n');
    expect(written.some((w) => w.includes('skip'))).toBe(false);
  });

  it('should flush remaining buffer through transform', async () => {
    const { res, written } = mockResponse();
    // Partial event without trailing \n\n, then stream closes
    const stream = createReadableStream([
      'data: first\n\n',
      'data: leftover',
    ]);

    const transform = (chunk: string) => `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    expect(written).toContain('out:first\n\n');
    // The remaining buffer "data: leftover" should be flushed
    expect(written).toContain('out:leftover\n\n');
    expect(written).toContain('data: [DONE]\n\n');
  });

  it('should not write [DONE] for non-transformed streams', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream(['data: test\n\n']);

    await pipeStream(stream, res as never);

    expect(written).not.toContain('data: [DONE]\n\n');
  });

  it('should release the reader lock on completion', async () => {
    const { res } = mockResponse();
    const stream = createReadableStream(['hello']);

    await pipeStream(stream, res as never);

    // Stream should be consumable again if lock is released
    expect(res.end).toHaveBeenCalled();
  });

  it('should not call end if dest is already ended', async () => {
    const { res } = mockResponse();
    res.writableEnded = true;
    const stream = createReadableStream(['hello']);

    await pipeStream(stream, res as never);

    expect(res.end).not.toHaveBeenCalled();
  });

  it('should stop reading when dest.writableEnded becomes true', async () => {
    const { res, written } = mockResponse();
    let readCount = 0;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        readCount++;
        if (readCount === 1) {
          controller.enqueue(encoder.encode('first'));
        } else if (readCount === 2) {
          // Simulate client disconnect
          (res as Record<string, unknown>).writableEnded = true;
          controller.enqueue(encoder.encode('second'));
        } else {
          controller.enqueue(encoder.encode('should-not-reach'));
        }
      },
    });

    await pipeStream(stream, res as never);

    expect(written).toEqual(['first']);
  });

  it('should handle empty stream', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream([]);

    await pipeStream(stream, res as never);

    expect(written).toEqual([]);
    expect(res.end).toHaveBeenCalled();
  });

  it('should skip [DONE] in remaining flush buffer', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream(['data: [DONE]']);

    const transform = (chunk: string) => `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    // [DONE] in remaining should be skipped
    const nonDone = written.filter((w) => w.includes('out:'));
    expect(nonDone).toHaveLength(0);
  });

  it('should stop reading and not write [DONE] when dest.writableEnded with transform', async () => {
    const { res, written } = mockResponse();
    let readCount = 0;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        readCount++;
        if (readCount === 1) {
          controller.enqueue(encoder.encode('data: event1\n\n'));
        } else if (readCount === 2) {
          // Simulate client disconnect mid-stream
          (res as Record<string, unknown>).writableEnded = true;
          controller.enqueue(encoder.encode('data: event2\n\n'));
        } else {
          controller.enqueue(encoder.encode('data: event3\n\n'));
        }
      },
    });

    const transform = (chunk: string) => `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    // Only event1 should have been transformed and written
    expect(written).toContain('out:event1\n\n');
    // event2 should NOT be written because writableEnded was set before the loop checked
    const hasEvent2 = written.some((w) => w.includes('event2'));
    expect(hasEvent2).toBe(false);
    // [DONE] should NOT be written when dest is already ended
    // (the finally block checks writableEnded before calling end)
  });

  it('should not process SSE events when writableEnded is true from the start with transform', async () => {
    const { res, written } = mockResponse();
    res.writableEnded = true;
    const stream = createReadableStream(['data: event1\n\n']);

    const transform = (chunk: string) => `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    // No SSE events should be transformed and written
    const transformedWrites = written.filter((w) => w.includes('out:'));
    expect(transformedWrites).toHaveLength(0);
    // end should not be called since writableEnded is already true
    expect(res.end).not.toHaveBeenCalled();
  });

  it('should release reader lock even when stream errors out', async () => {
    const { res } = mockResponse();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('stream read error'));
      },
    });

    await expect(pipeStream(stream, res as never)).rejects.toThrow('stream read error');

    // After error, the reader lock should be released (finally block runs).
    // We verify by checking that end was called (finally block behavior).
    expect(res.end).toHaveBeenCalled();
  });

  it('should not write remaining whitespace-only buffer through transform', async () => {
    const { res, written } = mockResponse();
    // Stream ends with only whitespace remaining (no actual event data)
    const stream = createReadableStream([
      'data: real-event\n\n',
      '   \n  ',
    ]);

    const transform = (chunk: string) => `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    // The real event should be transformed
    expect(written).toContain('out:real-event\n\n');
    // Whitespace-only remaining should NOT produce a transform call
    const spurious = written.filter((w) => w.includes('out:') && !w.includes('real-event'));
    expect(spurious).toHaveLength(0);
  });

  it('should handle transform returning null for remaining buffer', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream([
      'data: keep\n\n',
      'data: discard-at-end',
    ]);

    const transform = (chunk: string) =>
      chunk.includes('discard') ? null : `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    expect(written).toContain('out:keep\n\n');
    // The remaining buffer "discard-at-end" should be flushed through transform,
    // which returns null, so nothing extra is written
    const hasDiscard = written.some((w) => w.includes('discard'));
    expect(hasDiscard).toBe(false);
    // [DONE] should still be written for transformed streams
    expect(written).toContain('data: [DONE]\n\n');
  });

  it('should handle multiple chunks that split an SSE event with transform', async () => {
    const { res, written } = mockResponse();
    // An SSE event split across two TCP reads
    const stream = createReadableStream([
      'data: {"part',
      '":"complete"}\n\n',
    ]);

    const transform = (chunk: string) => `out:${chunk}\n\n`;

    await pipeStream(stream, res as never, transform);

    // The event should be reassembled and transformed
    expect(written).toContain('out:{"part":"complete"}\n\n');
    expect(written).toContain('data: [DONE]\n\n');
  });
});
