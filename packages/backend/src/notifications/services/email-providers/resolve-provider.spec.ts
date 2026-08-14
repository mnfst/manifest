import { createProvider } from './resolve-provider';
import { MailgunProvider } from './mailgun.provider';
import { SendGridProvider } from './sendgrid.provider';
import { ResendProvider } from './resend.provider';

describe('createProvider', () => {
  const baseConfig = { apiKey: 'test-key', domain: 'test.com' };

  it('returns MailgunProvider for mailgun', () => {
    const provider = createProvider({ ...baseConfig, provider: 'mailgun' });
    expect(provider).toBeInstanceOf(MailgunProvider);
    expect(provider.name).toBe('mailgun');
  });

  it('returns SendGridProvider for sendgrid', () => {
    const provider = createProvider({ ...baseConfig, provider: 'sendgrid' });
    expect(provider).toBeInstanceOf(SendGridProvider);
    expect(provider.name).toBe('sendgrid');
  });

  it('returns ResendProvider for resend', () => {
    const provider = createProvider({ ...baseConfig, provider: 'resend' });
    expect(provider).toBeInstanceOf(ResendProvider);
    expect(provider.name).toBe('resend');
  });

  it('throws for unknown provider', () => {
    expect(() => createProvider({ ...baseConfig, provider: 'unknown' as never }))
      .toThrow('Unknown email provider: unknown');
  });
});
