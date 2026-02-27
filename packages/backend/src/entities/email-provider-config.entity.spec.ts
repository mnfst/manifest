import { EmailProviderConfig } from './email-provider-config.entity';

describe('EmailProviderConfig entity', () => {
  it('creates an instance with all fields', () => {
    const config = new EmailProviderConfig();
    config.id = 'epc-1';
    config.user_id = 'user-1';
    config.provider = 'mailgun';
    config.api_key_encrypted = 'enc-abc123';
    config.domain = 'mg.example.com';
    config.notification_email = 'alerts@example.com';
    config.is_active = true;
    config.created_at = '2025-01-01T00:00:00Z';
    config.updated_at = '2025-01-02T00:00:00Z';

    expect(config.id).toBe('epc-1');
    expect(config.user_id).toBe('user-1');
    expect(config.provider).toBe('mailgun');
    expect(config.api_key_encrypted).toBe('enc-abc123');
    expect(config.domain).toBe('mg.example.com');
    expect(config.notification_email).toBe('alerts@example.com');
    expect(config.is_active).toBe(true);
    expect(config.created_at).toBe('2025-01-01T00:00:00Z');
    expect(config.updated_at).toBe('2025-01-02T00:00:00Z');
  });

  it('allows nullable fields to be null', () => {
    const config = new EmailProviderConfig();
    config.id = 'epc-2';
    config.user_id = 'user-2';
    config.provider = 'resend';
    config.api_key_encrypted = 'enc-xyz';
    config.domain = null;
    config.notification_email = null;
    config.is_active = true;
    config.created_at = '2025-06-01T00:00:00Z';
    config.updated_at = '2025-06-01T00:00:00Z';

    expect(config.domain).toBeNull();
    expect(config.notification_email).toBeNull();
  });

  it('supports all provider values', () => {
    const config = new EmailProviderConfig();
    for (const provider of ['resend', 'mailgun', 'sendgrid']) {
      config.provider = provider;
      expect(config.provider).toBe(provider);
    }
  });

  it('allows is_active to be set to false', () => {
    const config = new EmailProviderConfig();
    config.is_active = false;
    expect(config.is_active).toBe(false);
  });
});
