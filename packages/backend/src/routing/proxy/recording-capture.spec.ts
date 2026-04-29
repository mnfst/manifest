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

  it('overflows when JSON is set after streamed bytes (mixed shapes are rejected)', () => {
    // Streaming and JSON capture cannot coexist — the response body emitter
    // can only ship one shape, so any attempt to set JSON after streamed
    // bytes have arrived is treated as an overflow rather than silently
    // dropping the SSE buffer.
    const sink = createCaptureSink(1024);
    sink.appendRaw('data: hello\n\n');
    sink.setJson({ should: 'be dropped' });
    expect(sink.overflowed).toBe(true);
    expect(sink.jsonBody).toBeUndefined();
    expect(sink.buildResponseBody()).toBeNull();
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
  it('keeps allowlisted headers and drops everything else (lowercased keys)', () => {
    // Allowlist is the safer default: provider-echoed creds (e.g. x-api-key)
    // and arbitrary debugging headers must NOT make it into the recording.
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Set-Cookie', 'sid=abc');
    headers.set('Authorization', 'Bearer secret');
    headers.set('X-Trace', 'trace-1');
    headers.set('X-API-Key', 'echoed-secret');
    headers.set('WWW-Authenticate', 'Bearer realm="x"');
    headers.set('X-Request-Id', 'req-9');
    headers.set('X-RateLimit-Remaining', '42');

    const result = sanitizeResponseHeaders(headers);

    expect(result).toEqual({
      'content-type': 'application/json',
      'x-request-id': 'req-9',
      'x-ratelimit-remaining': '42',
    });
    expect(result['x-api-key']).toBeUndefined();
    expect(result['www-authenticate']).toBeUndefined();
    expect(result['x-trace']).toBeUndefined();
  });

  it('returns an empty object for empty headers', () => {
    expect(sanitizeResponseHeaders(new Headers())).toEqual({});
  });
});
