import {
  createCaptureSink,
  sanitizeResponseHeaders,
  RECORDING_MAX_BYTES,
} from './recording-capture';

describe('createCaptureSink', () => {
  it('accumulates raw SSE and reports size', () => {
    const sink = createCaptureSink(1000);
    sink.appendRaw('data: {"id":"1"}\n\n');
    sink.appendRaw('data: [DONE]\n\n');
    expect(sink.rawSse).toContain('{"id":"1"}');
    expect(sink.getSizeBytes()).toBeGreaterThan(0);
    expect(sink.overflowed).toBe(false);
    const body = sink.buildResponseBody();
    expect(body).toEqual({ type: 'stream', raw_sse: sink.rawSse });
  });

  it('marks overflow when raw exceeds limit and drops buffer', () => {
    const sink = createCaptureSink(10);
    sink.appendRaw('0123456789');
    expect(sink.overflowed).toBe(false);
    sink.appendRaw('x');
    expect(sink.overflowed).toBe(true);
    expect(sink.rawSse).toBe('');
    expect(sink.buildResponseBody()).toBeNull();
  });

  it('ignores further appends after overflow', () => {
    const sink = createCaptureSink(5);
    sink.appendRaw('abcdef');
    expect(sink.overflowed).toBe(true);
    sink.appendRaw('more');
    expect(sink.rawSse).toBe('');
    expect(sink.getSizeBytes()).toBe(0);
  });

  it('stores JSON body and returns structured response body', () => {
    const sink = createCaptureSink();
    sink.setJson({ foo: 'bar' });
    expect(sink.buildResponseBody()).toEqual({ type: 'json', body: { foo: 'bar' } });
    expect(sink.getSizeBytes()).toBeGreaterThan(0);
  });

  it('marks overflow when JSON body exceeds limit', () => {
    const big = 'x'.repeat(200);
    const sink = createCaptureSink(50);
    sink.setJson({ data: big });
    expect(sink.overflowed).toBe(true);
    expect(sink.jsonBody).toBeUndefined();
    expect(sink.buildResponseBody()).toBeNull();
  });

  it('treats unserializable values as empty without throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const sink = createCaptureSink();
    sink.setJson(circular);
    expect(sink.overflowed).toBe(false);
    expect(sink.jsonBody).toBeUndefined();
    expect(sink.buildResponseBody()).toBeNull();
  });

  it('does not set JSON after overflow', () => {
    const sink = createCaptureSink(5);
    sink.appendRaw('xxxxxx');
    expect(sink.overflowed).toBe(true);
    sink.setJson({ hi: 'there' });
    expect(sink.jsonBody).toBeUndefined();
  });

  it('stores sanitized headers', () => {
    const sink = createCaptureSink();
    sink.setHeaders({ 'content-type': 'application/json' });
    expect(sink.responseHeaders).toEqual({ 'content-type': 'application/json' });
  });

  it('returns null body when nothing captured', () => {
    const sink = createCaptureSink();
    expect(sink.buildResponseBody()).toBeNull();
  });

  it('defaults to the module-level max when no limit passed', () => {
    const sink = createCaptureSink();
    sink.appendRaw('a');
    expect(sink.overflowed).toBe(false);
    expect(RECORDING_MAX_BYTES).toBeGreaterThan(0);
  });
});

describe('sanitizeResponseHeaders', () => {
  it('strips sensitive headers and lowercases keys', () => {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Set-Cookie', 'sid=abc');
    headers.set('Authorization', 'Bearer secret');
    headers.set('X-Trace', 'trace-1');
    const result = sanitizeResponseHeaders(headers);
    expect(result).toEqual({
      'content-type': 'application/json',
      'x-trace': 'trace-1',
    });
  });

  it('returns an empty object for empty headers', () => {
    expect(sanitizeResponseHeaders(new Headers())).toEqual({});
  });
});
