import { normalizeProviderError } from '../provider-error-normalizer';
import type { PhoenixProviderError } from '../phoenix.types';

describe('normalizeProviderError', () => {
  it('extracts all four fields from an OpenAI-compatible envelope', () => {
    const raw = JSON.stringify({
      error: { message: 'm', type: 't', param: 'p', code: 'c' },
    });

    const result = normalizeProviderError(raw);

    // Assert the returned shape matches PhoenixProviderError exactly.
    const expected: PhoenixProviderError = {
      message: 'm',
      type: 't',
      param: 'p',
      code: 'c',
    };
    expect(result).toEqual(expected);
  });

  it('reads message from a flat body (no error key) and nulls the rest', () => {
    const raw = JSON.stringify({ message: 'm' });

    const result = normalizeProviderError(raw);

    expect(result).toEqual({ message: 'm', type: null, param: null, code: null });
  });

  it('uses the raw body as the message for a non-JSON body', () => {
    const result = normalizeProviderError('boom');

    expect(result).toEqual({ message: 'boom', type: null, param: null, code: null });
  });

  it('falls back to the raw body when JSON parses to a non-object (number)', () => {
    const result = normalizeProviderError('123');

    // JSON.parse('123') === 123, which is not an object → parsed stays null.
    expect(result).toEqual({ message: '123', type: null, param: null, code: null });
  });

  it('falls back to the raw body when JSON parses to null', () => {
    const result = normalizeProviderError('null');

    // JSON.parse('null') === null → the `json && typeof json === 'object'`
    // guard is false, so parsed stays null.
    expect(result).toEqual({ message: 'null', type: null, param: null, code: null });
  });

  it('scrubs an Anthropic-style secret out of the message', () => {
    const secret = `sk-ant-${'a'.repeat(24)}`;
    const raw = JSON.stringify({ error: { message: `bad key ${secret}` } });

    const result = normalizeProviderError(raw);

    expect(result.message).not.toContain(secret);
    expect(result.message).toContain('[REDACTED]');
  });

  it('scrubs a Bearer token out of the message', () => {
    const raw = JSON.stringify({
      error: { message: 'auth failed: Bearer abcdefghijklmnop' },
    });

    const result = normalizeProviderError(raw);

    expect(result.message).not.toContain('abcdefghijklmnop');
    expect(result.message).toContain('Bearer [REDACTED]');
  });

  it('scrubs secrets out of type, param and code (not just message)', () => {
    const secret = `sk-ant-${'a'.repeat(24)}`;
    const raw = JSON.stringify({
      error: { message: 'm', type: `t ${secret}`, param: `p ${secret}`, code: `c ${secret}` },
    });

    const result = normalizeProviderError(raw);

    for (const field of [result.type, result.param, result.code]) {
      expect(field).not.toContain(secret);
      expect(field).toContain('[REDACTED]');
    }
  });

  it('truncates a very long message to 2000 characters', () => {
    const longMessage = 'x'.repeat(5000);
    const raw = JSON.stringify({ error: { message: longMessage } });

    const result = normalizeProviderError(raw);

    expect(result.message).toHaveLength(2000);
    expect(result.message).toBe('x'.repeat(2000));
  });

  it('prefers error.message over a top-level message when both are present', () => {
    const raw = JSON.stringify({
      message: 'top',
      error: { message: 'nested', type: 'nested_type' },
    });

    const result = normalizeProviderError(raw);

    expect(result.message).toBe('nested');
    expect(result.type).toBe('nested_type');
  });

  it('ignores an empty-string error.message and falls back to the top-level message', () => {
    // coerceString returns null for empty strings, exercising the ?? chain's
    // first fallback (error.message empty → parsed.message).
    const raw = JSON.stringify({ message: 'fallback', error: { message: '' } });

    const result = normalizeProviderError(raw);

    expect(result.message).toBe('fallback');
  });

  it('treats a null error field as absent and reads the flat body', () => {
    // parsed.error is present but null → the `parsed.error !== null` guard is
    // false, so errorObj falls back to parsed itself.
    const raw = JSON.stringify({ message: 'flat', error: null });

    const result = normalizeProviderError(raw);

    expect(result).toEqual({ message: 'flat', type: null, param: null, code: null });
  });
});
