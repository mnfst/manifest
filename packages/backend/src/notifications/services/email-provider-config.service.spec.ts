jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html>test</html>'),
}));

jest.mock('../emails/test-email', () => ({
  TestEmail: jest.fn(() => 'mock-test-email'),
}));

jest.mock('./email-providers/resolve-provider', () => ({
  createProvider: jest.fn(() => ({
    send: jest.fn().mockResolvedValue(true),
  })),
}));

import { BadRequestException } from '@nestjs/common';
import { EmailProviderConfigService } from './email-provider-config.service';
import { createProvider } from './email-providers/resolve-provider';

function createMockDataSource(rows: Record<string, unknown>[][] = [[]]) {
  let callIndex = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      const result = rows[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(result);
    }),
    options: { type: 'postgres' },
  } as any;
}

describe('EmailProviderConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- getConfig ---
  describe('getConfig', () => {
    it('returns null when no config exists', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getConfig('user-1');
      expect(result).toBeNull();
    });

    it('returns public config with keyPrefix', async () => {
      const ds = createMockDataSource([[{
        provider: 'resend',
        domain: 'example.com',
        api_key_encrypted: 're_abcdef123456',
        is_active: 1,
        notification_email: 'alerts@test.com',
      }]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getConfig('user-1');
      expect(result).toEqual({
        provider: 'resend',
        domain: 'example.com',
        keyPrefix: 're_abcde',
        is_active: true,
        notificationEmail: 'alerts@test.com',
      });
    });

    it('returns null domain and email when not set', async () => {
      const ds = createMockDataSource([[{
        provider: 'resend',
        domain: undefined,
        api_key_encrypted: 're_testkey1234',
        is_active: 1,
        notification_email: undefined,
      }]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getConfig('user-1');
      expect(result!.domain).toBeNull();
      expect(result!.notificationEmail).toBeNull();
    });
  });

  // --- upsert ---
  describe('upsert', () => {
    it('inserts new config when none exists', async () => {
      const ds = createMockDataSource([
        [], // SELECT existing
        [], // INSERT
      ]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.upsert('user-1', {
        provider: 'resend',
        apiKey: 're_testkey12345678',
        notificationEmail: 'test@test.com',
      });
      expect(result.provider).toBe('resend');
      expect(result.is_active).toBe(true);
      expect(result.keyPrefix).toBe('re_testk');
      expect(result.notificationEmail).toBe('test@test.com');
      expect(ds.query).toHaveBeenCalledTimes(2);
    });

    it('updates existing config with new API key', async () => {
      const ds = createMockDataSource([
        [{ id: 'existing-id', api_key_encrypted: 're_oldkey12345678' }], // SELECT existing
        [], // UPDATE
      ]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.upsert('user-1', {
        provider: 'resend',
        apiKey: 're_newkey12345678',
      });
      expect(result.provider).toBe('resend');
      expect(result.keyPrefix).toBe('re_newke');
    });

    it('updates without API key — keeps existing key', async () => {
      const ds = createMockDataSource([
        [{ id: 'existing-id', api_key_encrypted: 're_existingkey123' }], // SELECT existing
        [], // UPDATE
      ]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.upsert('user-1', {
        provider: 'resend',
        notificationEmail: 'new@test.com',
      });
      expect(result.provider).toBe('resend');
      expect(result.keyPrefix).toBe('re_exist');
      expect(result.notificationEmail).toBe('new@test.com');
    });

    it('throws when no existing config and no API key', async () => {
      const ds = createMockDataSource([
        [], // no existing
      ]);
      const service = new EmailProviderConfigService(ds);
      await expect(
        service.upsert('user-1', { provider: 'resend' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws on invalid provider config', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      await expect(
        service.upsert('user-1', { provider: 'resend', apiKey: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('normalizes notification email', async () => {
      const ds = createMockDataSource([[], []]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.upsert('user-1', {
        provider: 'resend',
        apiKey: 're_testkey12345678',
        notificationEmail: '  User@Test.COM  ',
      });
      expect(result.notificationEmail).toBe('user@test.com');
    });

    it('handles mailgun with domain', async () => {
      const ds = createMockDataSource([[], []]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.upsert('user-1', {
        provider: 'mailgun',
        apiKey: 'key-1234567890abc',
        domain: 'mg.example.com',
      });
      expect(result.provider).toBe('mailgun');
      expect(result.domain).toBe('mg.example.com');
    });
  });

  // --- remove ---
  describe('remove', () => {
    it('deletes config for user', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      await service.remove('user-1');
      expect(ds.query).toHaveBeenCalledTimes(1);
    });
  });

  // --- getFullConfig ---
  describe('getFullConfig', () => {
    it('returns null when no active config', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getFullConfig('user-1');
      expect(result).toBeNull();
    });

    it('returns full config with API key', async () => {
      const ds = createMockDataSource([[{
        provider: 'resend',
        api_key_encrypted: 're_fullkey12345678',
        domain: 'example.com',
        notification_email: 'alerts@test.com',
      }]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getFullConfig('user-1');
      expect(result).toEqual({
        provider: 'resend',
        apiKey: 're_fullkey12345678',
        domain: 'example.com',
        notificationEmail: 'alerts@test.com',
      });
    });

    it('returns null domain and email when not set', async () => {
      const ds = createMockDataSource([[{
        provider: 'resend',
        api_key_encrypted: 're_fullkey12345678',
        domain: undefined,
        notification_email: undefined,
      }]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getFullConfig('user-1');
      expect(result!.domain).toBeNull();
      expect(result!.notificationEmail).toBeNull();
    });
  });

  // --- getNotificationEmail ---
  describe('getNotificationEmail', () => {
    it('returns null when no config exists', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getNotificationEmail('user-1');
      expect(result).toBeNull();
    });

    it('returns notification email when set', async () => {
      const ds = createMockDataSource([[{ notification_email: 'alerts@test.com' }]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.getNotificationEmail('user-1');
      expect(result).toBe('alerts@test.com');
    });
  });

  // --- setNotificationEmail ---
  describe('setNotificationEmail', () => {
    it('updates email when config exists', async () => {
      const ds = createMockDataSource([
        [{ id: 'existing-id' }], // SELECT existing
        [], // UPDATE
      ]);
      const service = new EmailProviderConfigService(ds);
      await service.setNotificationEmail('user-1', 'New@Email.COM');
      expect(ds.query).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no config exists', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      await service.setNotificationEmail('user-1', 'test@test.com');
      expect(ds.query).toHaveBeenCalledTimes(1); // only the SELECT
    });
  });

  // --- testSavedConfig ---
  describe('testSavedConfig', () => {
    it('returns error when no config exists', async () => {
      const ds = createMockDataSource([[]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.testSavedConfig('user-1', 'test@test.com');
      expect(result).toEqual({ success: false, error: 'No email provider configured' });
    });

    it('calls testConfig with saved credentials', async () => {
      const ds = createMockDataSource([[{
        provider: 'resend',
        api_key_encrypted: 're_savedkey12345678',
        domain: null,
        notification_email: null,
      }]]);
      const service = new EmailProviderConfigService(ds);
      const result = await service.testSavedConfig('user-1', 'test@test.com');
      expect(result).toEqual({ success: true });
      expect(createProvider).toHaveBeenCalled();
    });
  });

  // --- testConfig ---
  describe('testConfig', () => {
    it('returns success when provider sends', async () => {
      const ds = createMockDataSource();
      const service = new EmailProviderConfigService(ds);
      const result = await service.testConfig(
        { provider: 'resend', apiKey: 're_testkey12345678' },
        'test@test.com',
      );
      expect(result).toEqual({ success: true });
    });

    it('returns error on invalid config', async () => {
      const ds = createMockDataSource();
      const service = new EmailProviderConfigService(ds);
      const result = await service.testConfig(
        { provider: 'resend', apiKey: 'bad' },
        'test@test.com',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when provider fails', async () => {
      (createProvider as jest.Mock).mockReturnValue({
        send: jest.fn().mockResolvedValue(false),
      });
      const ds = createMockDataSource();
      const service = new EmailProviderConfigService(ds);
      const result = await service.testConfig(
        { provider: 'resend', apiKey: 're_testkey12345678' },
        'test@test.com',
      );
      expect(result).toEqual({ success: false, error: 'Provider returned failure' });
    });

    it('returns error on exception', async () => {
      (createProvider as jest.Mock).mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('Network error')),
      });
      const ds = createMockDataSource();
      const service = new EmailProviderConfigService(ds);
      const result = await service.testConfig(
        { provider: 'resend', apiKey: 're_testkey12345678' },
        'test@test.com',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('uses custom domain in from address when provided', async () => {
      const mockSend = jest.fn().mockResolvedValue(true);
      (createProvider as jest.Mock).mockReturnValue({ send: mockSend });
      const ds = createMockDataSource();
      const service = new EmailProviderConfigService(ds);
      await service.testConfig(
        { provider: 'mailgun', apiKey: 'key-1234567890abc', domain: 'mg.example.com' },
        'test@test.com',
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Manifest <noreply@mg.example.com>',
        }),
      );
    });
  });
});
