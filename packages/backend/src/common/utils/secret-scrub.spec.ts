import { scrubSecrets } from './secret-scrub';

describe('scrubSecrets', () => {
  it('returns empty string for null', () => {
    expect(scrubSecrets(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(scrubSecrets(undefined)).toBe('');
  });

  it('returns empty string unchanged', () => {
    expect(scrubSecrets('')).toBe('');
  });

  it('redacts bare Anthropic sk-ant- keys', () => {
    const out = scrubSecrets('auth failed for sk-ant-api03-abcdefghijklmnop');
    expect(out).not.toContain('abcdefghijklmnop');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts OpenAI project keys (sk-proj-)', () => {
    const out = scrubSecrets('key sk-proj-abcdefghijklmnop is invalid');
    expect(out).not.toContain('abcdefghijklmnop');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts generic OpenAI sk- keys', () => {
    const out = scrubSecrets('sk-abcdefghijklmnopqrstuv rejected');
    expect(out).not.toContain('abcdefghijklmnopqrstuv');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Groq gsk_ keys', () => {
    const out = scrubSecrets('token gsk_abcdefghij123456');
    expect(out).not.toContain('abcdefghij123456');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts xAI xai- keys', () => {
    const out = scrubSecrets('got xai-abcdefghij12345');
    expect(out).not.toContain('abcdefghij12345');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Manifest mnfst_ keys', () => {
    const out = scrubSecrets('bad token mnfst_abcdefghij12345');
    expect(out).not.toContain('abcdefghij12345');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Google AIza- keys', () => {
    const out = scrubSecrets('AIzaSyAbcdefghij12345678');
    expect(out).not.toContain('Abcdefghij12345678');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Bearer tokens', () => {
    const out = scrubSecrets('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(out).toContain('Bearer [REDACTED]');
  });

  it('redacts Bearer tokens regardless of scheme casing', () => {
    // HTTP is nominally case-insensitive; some servers/clients emit "bearer"
    // or "BEARER". All should scrub.
    for (const scheme of ['bearer', 'BEARER', 'BeArEr']) {
      const out = scrubSecrets(`${scheme} eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`);
      expect(out).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(out).toContain('[REDACTED]');
    }
  });

  it('redacts ?key= query parameters (Google-style)', () => {
    const out = scrubSecrets('GET /v1/models?key=AIzaSyAbcdefg&alt=json');
    expect(out).not.toContain('AIzaSyAbcdefg');
    expect(out).toContain('?key=[REDACTED]');
  });

  it('redacts &key= query parameters', () => {
    const out = scrubSecrets('url?foo=bar&key=secretvalue123');
    expect(out).not.toContain('secretvalue123');
    expect(out).toContain('&key=[REDACTED]');
  });

  it('redacts x-api-key header (case-insensitive)', () => {
    expect(scrubSecrets('X-API-Key: somesecretvalue')).toContain('X-API-Key: [REDACTED]');
    expect(scrubSecrets('x-api-key: abc123xyz')).toContain('x-api-key: [REDACTED]');
  });

  it('redacts authorization header with a non-Bearer scheme', () => {
    const out = scrubSecrets('Authorization: Basic dXNlcjpwYXNz');
    expect(out).not.toContain('dXNlcjpwYXNz');
    expect(out).toContain('Authorization:');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts api-key header form', () => {
    const out = scrubSecrets('api-key: myplainkey123');
    expect(out).not.toContain('myplainkey123');
    expect(out).toContain('api-key: [REDACTED]');
  });

  it('redacts quoted header values', () => {
    const out = scrubSecrets('"x-api-key": "sk-liveabcdefghij"');
    expect(out).not.toContain('sk-liveabcdefghij');
    expect(out).toContain('[REDACTED]');
  });

  it('leaves short strings untouched (no false positives)', () => {
    expect(scrubSecrets('skiing is fun')).toBe('skiing is fun');
    expect(scrubSecrets('task-manager')).toBe('task-manager');
    expect(scrubSecrets('Bearer x')).toBe('Bearer x');
  });

  it('leaves benign prose untouched', () => {
    const input = 'Rate limit exceeded. Please retry after 10 seconds.';
    expect(scrubSecrets(input)).toBe(input);
  });

  it('redacts multiple secrets in one string', () => {
    const out = scrubSecrets('got sk-abcdefghij12345 and gsk_abcdefghij67890 in one body');
    expect(out).not.toContain('abcdefghij12345');
    expect(out).not.toContain('abcdefghij67890');
    expect(out).toContain('[REDACTED]');
  });

  it('is idempotent on already-scrubbed text', () => {
    const once = scrubSecrets('token sk-abcdefghij12345 rejected');
    const twice = scrubSecrets(once);
    expect(twice).toBe(once);
  });

  it('redacts a realistic Anthropic 401 body', () => {
    const body = JSON.stringify({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Invalid x-api-key: sk-ant-api03-SECRETKEYVALUE12345',
      },
    });
    const out = scrubSecrets(body);
    expect(out).not.toContain('SECRETKEYVALUE12345');
    expect(out).toContain('[REDACTED]');
  });
});
