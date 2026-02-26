import { initSseHeaders, pipeStream } from '../stream-writer';

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

  it('should pipe chunks directly to destination', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream(['hello', ' world']);

    await pipeStream(stream, res as never);

    expect(written).toEqual(['hello', ' world']);
    expect(res.end).toHaveBeenCalled();
  });

  it('should release the reader lock on completion', async () => {
    const { res } = mockResponse();
    const stream = createReadableStream(['hello']);

    await pipeStream(stream, res as never);

    expect(res.end).toHaveBeenCalled();
  });

  it('should not call end if dest is already ended', async () => {
    const { res } = mockResponse();
    res.writableEnded = true;
    const stream = createReadableStream(['hello']);

    await pipeStream(stream, res as never);

    expect(res.end).not.toHaveBeenCalled();
  });

  it('should handle empty stream', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream([]);

    await pipeStream(stream, res as never);

    expect(written).toEqual([]);
    expect(res.end).toHaveBeenCalled();
  });

  it('should pipe SSE data chunks through unchanged', async () => {
    const { res, written } = mockResponse();
    const stream = createReadableStream([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    await pipeStream(stream, res as never);

    expect(written).toEqual([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
  });
});
