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

  describe('sensitive pattern sanitization in non-production', () => {
    it('redacts OpenAI API keys from error messages', () => {
      const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      const body = JSON.stringify({ error: { message: `Invalid key: ${key}` } });
      const result = sanitizeProviderError(401, body, 'development');
      expect(result).not.toContain(key);
      expect(result).toContain('sk-***');
    });

    it('redacts Anthropic API keys from error messages', () => {
      const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz';
      const body = JSON.stringify({ error: { message: `Auth failed: ${key}` } });
      const result = sanitizeProviderError(401, body, 'development');
      expect(result).not.toContain(key);
      expect(result).toContain('sk-ant-***');
    });

    it('redacts key= query parameters from error messages', () => {
      const body = JSON.stringify({
        error: { message: 'Failed at url?key=AIzaSyAbcdef123456789' },
      });
      const result = sanitizeProviderError(400, body, 'development');
      expect(result).not.toContain('AIzaSyAbcdef123456789');
      expect(result).toContain('key=***');
    });

    it('redacts Bearer tokens from error messages', () => {
      const body = JSON.stringify({
        error: { message: 'Header was: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp' },
      });
      const result = sanitizeProviderError(401, body, 'development');
      expect(result).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp');
      expect(result).toContain('Bearer ***');
    });

    it('redacts lowercase bearer tokens from error messages', () => {
      const body = JSON.stringify({
        error: { message: 'Header was: bearer eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp' },
      });
      const result = sanitizeProviderError(401, body, 'development');
      expect(result).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp');
      expect(result).toContain('Bearer ***');
    });

    it('does not redact patterns in production mode', () => {
      const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
      const body = JSON.stringify({ error: { message: `Invalid key: ${key}` } });
      const result = sanitizeProviderError(401, body, 'production');
      expect(result).toBe('Authentication failed with upstream provider');
    });
  });
});
