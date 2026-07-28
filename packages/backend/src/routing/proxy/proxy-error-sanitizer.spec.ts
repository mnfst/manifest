import {
  classifyProviderError,
  openAiErrorTypeForStatus,
  normalizeProviderErrorForStorage,
  sanitizeProviderError,
} from './proxy-error-sanitizer';

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
      'Upstream endpoint returned HTTP 418',
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

  it('reports an offline ngrok endpoint instead of a missing model', () => {
    const body =
      '<!DOCTYPE html><html><noscript>The endpoint example.ngrok-free.dev is offline. (ERR_NGROK_3200)</noscript></html>';
    expect(sanitizeProviderError(404, body, 'production')).toBe(
      'Tunnel endpoint is offline (ERR_NGROK_3200)',
    );
  });

  it('describes generic HTML failures as endpoint responses', () => {
    expect(sanitizeProviderError(404, '<html><body>Not found</body></html>', 'production')).toBe(
      'Upstream endpoint returned HTTP 404',
    );
  });

  it('detects HTML error pages prefixed by server comments', () => {
    const body = '\n\t<!-- served by edge --><html><body>Not found</body></html>';
    expect(sanitizeProviderError(404, body, 'production')).toBe(
      'Upstream endpoint returned HTTP 404',
    );
  });

  it('does not treat an unterminated leading comment as HTML', () => {
    expect(sanitizeProviderError(502, '<!-- edge failure', 'production')).toBe(
      'Upstream provider returned bad gateway',
    );
  });

  it('detects many leading HTML comments without backtracking', () => {
    const body = `${'<!-- edge -->'.repeat(1_000)}<html><body>Not found</body></html>`;
    expect(sanitizeProviderError(404, body, 'production')).toBe(
      'Upstream endpoint returned HTTP 404',
    );
  });

  it('does not classify an HTML page as a model context error', () => {
    const body = '<html><body>context_length_exceeded while rendering the error</body></html>';
    expect(sanitizeProviderError(404, body, 'production')).toBe(
      'Upstream endpoint returned HTTP 404',
    );
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

describe('normalizeProviderErrorForStorage', () => {
  it('collapses HTML error pages to a concise diagnostic', () => {
    expect(normalizeProviderErrorForStorage(502, '<!doctype html><p>Bad gateway</p>')).toBe(
      'Upstream endpoint returned HTTP 502',
    );
  });

  it('collapses HTML error pages even when no HTTP status was captured', () => {
    expect(normalizeProviderErrorForStorage(undefined, '<html><p>Tunnel failed</p></html>')).toBe(
      'Upstream endpoint returned an HTML error page',
    );
  });

  it('collapses comment-prefixed HTML error pages for storage', () => {
    const body = '<!-- proxy --><!doctype html><p>Bad gateway</p>';
    expect(normalizeProviderErrorForStorage(502, body)).toBe('Upstream endpoint returned HTTP 502');
  });

  it('preserves an offline ngrok diagnostic when no HTTP status was captured', () => {
    const body =
      '<!DOCTYPE html><html><noscript>The endpoint example.ngrok-free.dev is offline. (ERR_NGROK_3200)</noscript></html>';
    expect(normalizeProviderErrorForStorage(null, body)).toBe(
      'Tunnel endpoint is offline (ERR_NGROK_3200)',
    );
  });

  it('keeps structured and plain-text provider errors unchanged', () => {
    const json = '{"error":{"message":"bad model"}}';
    expect(normalizeProviderErrorForStorage(400, json)).toBe(json);
    expect(normalizeProviderErrorForStorage(500, 'socket closed')).toBe('socket closed');
  });
});

describe('classifyProviderError', () => {
  it('classifies provider context overflow and preserves the provider message', () => {
    const message =
      "This model's maximum context length is 262144 tokens. However, your messages resulted in 334146 tokens.";

    expect(
      classifyProviderError(
        400,
        JSON.stringify({
          error: {
            message,
            type: 'invalid_request_error',
            code: 'context_length_exceeded',
          },
        }),
      ),
    ).toEqual({
      message,
      type: 'invalid_request_error',
      code: 'context_length_exceeded',
      source: 'provider',
    });
  });

  it('returns context overflow messages in production instead of the generic 400', () => {
    const message =
      "This endpoint's maximum context length is 262144 tokens. Please reduce the messages.";

    expect(
      sanitizeProviderError(
        400,
        JSON.stringify({ error: { message, code: 'context_length_exceeded' } }),
        'production',
      ),
    ).toBe(message);
  });

  it('classifies exact context overflow provider codes even when the message is generic', () => {
    expect(
      classifyProviderError(
        400,
        JSON.stringify({
          error: {
            message: 'Request rejected by upstream provider',
            code: 'context_length_exceeded',
          },
        }),
      ),
    ).toEqual({
      message: 'Request rejected by upstream provider',
      type: 'invalid_request_error',
      code: 'context_length_exceeded',
      source: 'provider',
    });
  });

  it('scrubs secrets from classified provider messages', () => {
    expect(
      classifyProviderError(
        400,
        JSON.stringify({
          error: {
            message:
              'Maximum context length exceeded for key=abc123 and Bearer sk-live-secret-token-value',
          },
        }),
      )?.message,
    ).toBe('Maximum context length exceeded for key=*** and Bearer ***');
  });

  it('does not classify generic input length validation errors as context overflow', () => {
    expect(
      classifyProviderError(
        400,
        JSON.stringify({ error: { message: 'Field input.name is too long' } }),
      ),
    ).toBeNull();
  });

  it('does not classify generic token quota messages as context overflow', () => {
    expect(
      classifyProviderError(
        400,
        JSON.stringify({ error: { message: 'You hit your tokens limit' } }),
      ),
    ).toBeNull();
  });
});

describe('openAiErrorTypeForStatus', () => {
  it.each([
    [400, 'invalid_request_error'],
    [401, 'authentication_error'],
    [403, 'permission_error'],
    [429, 'rate_limit_error'],
    [500, 'server_error'],
  ])('maps HTTP %d to OpenAI-compatible type %s', (status, type) => {
    expect(openAiErrorTypeForStatus(status)).toBe(type);
  });
});
