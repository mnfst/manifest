import { sanitizeProviderError } from './proxy-error-sanitizer';

describe('sanitizeProviderError', () => {
  it('extracts error.message from JSON body in non-production', () => {
    const body = JSON.stringify({ error: { message: 'Rate limit exceeded' } });
    expect(sanitizeProviderError(429, body, 'development')).toBe('Rate limit exceeded');
  });

  it('extracts top-level message from JSON body in non-production', () => {
    const body = JSON.stringify({ message: 'Invalid model' });
    expect(sanitizeProviderError(400, body, 'development')).toBe('Invalid model');
  });

  it('truncates long messages to 500 characters', () => {
    const longMsg = 'x'.repeat(600);
    const body = JSON.stringify({ error: { message: longMsg } });
    expect(sanitizeProviderError(500, body, 'development')).toHaveLength(500);
  });

  it('returns known message for 401 with non-JSON body', () => {
    expect(sanitizeProviderError(401, 'Unauthorized', 'development')).toBe(
      'Authentication failed with upstream provider',
    );
  });

  it('returns known message for 429 with empty JSON error', () => {
    const body = JSON.stringify({ error: {} });
    expect(sanitizeProviderError(429, body, 'development')).toBe(
      'Rate limited by upstream provider',
    );
  });

  it('returns generic message for unknown status with non-JSON body', () => {
    expect(sanitizeProviderError(418, '<html>Teapot</html>', 'development')).toBe(
      'Upstream provider returned HTTP 418',
    );
  });

  it('returns known message for each mapped status code', () => {
    expect(sanitizeProviderError(400, '')).toBe('Bad request to upstream provider');
    expect(sanitizeProviderError(403, '')).toBe('Forbidden by upstream provider');
    expect(sanitizeProviderError(404, '')).toBe('Model or endpoint not found');
    expect(sanitizeProviderError(408, '')).toBe('Upstream provider request timed out');
    expect(sanitizeProviderError(422, '')).toBe('Upstream provider rejected the request');
    expect(sanitizeProviderError(500, '')).toBe('Upstream provider internal error');
    expect(sanitizeProviderError(502, '')).toBe('Upstream provider returned bad gateway');
    expect(sanitizeProviderError(503, '')).toBe('Upstream provider temporarily unavailable');
    expect(sanitizeProviderError(504, '')).toBe('Upstream provider gateway timeout');
  });

  it('ignores empty string message in JSON', () => {
    const body = JSON.stringify({ error: { message: '' } });
    expect(sanitizeProviderError(500, body, 'development')).toBe(
      'Upstream provider internal error',
    );
  });

  it('returns generic message in production mode even when JSON has message', () => {
    const body = JSON.stringify({ error: { message: 'Detailed internal error' } });
    expect(sanitizeProviderError(500, body, 'production')).toBe('Upstream provider internal error');
  });

  it('defaults to production behavior when nodeEnv is omitted', () => {
    const body = JSON.stringify({ error: { message: 'Should not leak' } });
    expect(sanitizeProviderError(500, body)).toBe('Upstream provider internal error');
  });
});
