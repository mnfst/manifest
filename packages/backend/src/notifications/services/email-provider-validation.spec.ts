import { validateProviderConfig } from './email-provider-validation';

describe('validateProviderConfig', () => {
  it('accepts valid Resend config', () => {
    const result = validateProviderConfig('resend', 're_abcdefghij', 'example.com');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalized).toEqual({
      provider: 'resend',
      apiKey: 're_abcdefghij',
      domain: 'example.com',
    });
  });

  it('accepts valid Mailgun config', () => {
    const result = validateProviderConfig('mailgun', 'key-12345678', 'mg.example.com');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects Resend key without re_ prefix', () => {
    const result = validateProviderConfig('resend', 'abcdefghij', 'example.com');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Resend API key must start with re_');
  });

  it('rejects key shorter than 8 chars', () => {
    const result = validateProviderConfig('mailgun', 'short', 'example.com');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('API key must be at least 8 characters');
  });

  it('rejects empty domain', () => {
    const result = validateProviderConfig('resend', 're_abcdefghij', '');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Domain is required');
  });

  it('rejects invalid domain format', () => {
    const result = validateProviderConfig('resend', 're_abcdefghij', 'not a domain');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid domain format');
  });

  it('normalizes domain to lowercase', () => {
    const result = validateProviderConfig('mailgun', 'key-12345678', 'MG.Example.COM');
    expect(result.valid).toBe(true);
    expect(result.normalized.domain).toBe('mg.example.com');
  });

  it('trims whitespace from key and domain', () => {
    const result = validateProviderConfig('mailgun', '  key-12345678  ', '  mg.example.com  ');
    expect(result.valid).toBe(true);
    expect(result.normalized.apiKey).toBe('key-12345678');
    expect(result.normalized.domain).toBe('mg.example.com');
  });

  it('returns multiple errors at once', () => {
    const result = validateProviderConfig('resend', 're_', '');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('does not require re_ prefix for Mailgun', () => {
    const result = validateProviderConfig('mailgun', 'abcdefghij', 'example.com');
    expect(result.valid).toBe(true);
  });
});
