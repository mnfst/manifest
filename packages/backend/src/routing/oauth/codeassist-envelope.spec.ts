import { unwrapCodeAssistResponse, unwrapCodeAssistStreamChunk } from './codeassist-envelope';

describe('unwrapCodeAssistResponse', () => {
  it('returns the inner response object when wrapper is present', () => {
    const inner = { candidates: [{ content: 'hello' }] };
    const result = unwrapCodeAssistResponse({ response: inner, traceId: 'abc' });
    expect(result).toBe(inner);
  });

  it('falls through unchanged when response key is absent', () => {
    const body = { foo: 1 };
    const result = unwrapCodeAssistResponse(body);
    expect(result).toBe(body);
  });

  it('falls through unchanged when response is not an object (string)', () => {
    const body = { response: 'not-an-object' };
    const result = unwrapCodeAssistResponse(body as Record<string, unknown>);
    expect(result).toBe(body);
  });

  it('falls through unchanged when response is null', () => {
    const body = { response: null };
    const result = unwrapCodeAssistResponse(body as Record<string, unknown>);
    expect(result).toBe(body);
  });
});

describe('unwrapCodeAssistStreamChunk', () => {
  it('rewrites a data: line containing a response wrapper to its inner object', () => {
    const inner = { candidates: [1] };
    const wrapped = { response: inner };
    const chunk = `data: ${JSON.stringify(wrapped)}\n`;
    const result = unwrapCodeAssistStreamChunk(chunk);
    expect(result).toBe(`data: ${JSON.stringify(inner)}\n`);
  });

  it('rewrites a bare parsed SSE payload containing a response wrapper', () => {
    const inner = { candidates: [1] };
    const chunk = JSON.stringify({ response: inner });
    const result = unwrapCodeAssistStreamChunk(chunk);
    expect(result).toBe(JSON.stringify(inner));
  });

  it('passes through event: lines without modification', () => {
    const line = 'event: content_block_delta\n';
    expect(unwrapCodeAssistStreamChunk(line)).toBe(line);
  });

  it('passes through blank lines without modification', () => {
    const chunk = '\n\n';
    expect(unwrapCodeAssistStreamChunk(chunk)).toBe(chunk);
  });

  it('passes through data: [DONE] without modification', () => {
    const line = 'data: [DONE]\n';
    expect(unwrapCodeAssistStreamChunk(line)).toBe(line);
  });

  it('only rewrites data: lines and leaves other line types in a multi-line chunk unchanged', () => {
    const inner = { candidates: [{ text: 'hi' }] };
    const chunk = [
      `data: ${JSON.stringify({ response: inner })}`,
      'event: keep-this',
      '',
      'data: [DONE]',
    ].join('\n');

    const result = unwrapCodeAssistStreamChunk(chunk);
    const lines = result.split('\n');
    expect(lines[0]).toBe(`data: ${JSON.stringify(inner)}`);
    expect(lines[1]).toBe('event: keep-this');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('data: [DONE]');
  });

  it('passes through a data: line with malformed JSON unchanged (no throw)', () => {
    const line = 'data: {invalid-json}\n';
    expect(() => unwrapCodeAssistStreamChunk(line)).not.toThrow();
    expect(unwrapCodeAssistStreamChunk(line)).toBe(line);
  });

  it('passes through a data: line whose JSON has no response key unchanged', () => {
    const line = `data: ${JSON.stringify({ candidates: [1] })}\n`;
    const result = unwrapCodeAssistStreamChunk(line);
    expect(result).toBe(line);
  });
});
