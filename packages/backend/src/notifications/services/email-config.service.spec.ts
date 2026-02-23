jest.mock('../../common/constants/local-mode.constants', () => ({
  readLocalEmailConfig: jest.fn(),
  writeLocalEmailConfig: jest.fn(),
  clearLocalEmailConfig: jest.fn(),
}));

jest.mock('./email-providers/resolve-provider', () => ({
  createProvider: jest.fn(),
}));

jest.mock('@react-email/render', () => ({
  render: jest.fn().mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
    Promise.resolve(opts?.plainText ? 'plain text version' : '<html>rendered</html>'),
  ),
}));

jest.mock('../emails/test-email', () => ({
  TestEmail: jest.fn(() => 'mock-test-element'),
}));

import { BadRequestException } from '@nestjs/common';
import { EmailConfigService } from './email-config.service';
import {
  readLocalEmailConfig,
  writeLocalEmailConfig,
  clearLocalEmailConfig,
} from '../../common/constants/local-mode.constants';
import { createProvider } from './email-providers/resolve-provider';

describe('EmailConfigService (local mode)', () => {
  let service: EmailConfigService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MANIFEST_MODE: 'local' };
    service = new EmailConfigService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('returns configured: false when no local config', () => {
      (readLocalEmailConfig as jest.Mock).mockReturnValue(null);
      const result = service.getConfig();
      expect(result).toEqual({ configured: false });
    });

    it('returns config details when configured', () => {
      (readLocalEmailConfig as jest.Mock).mockReturnValue({
        provider: 'resend',
        apiKey: 'secret',
        fromEmail: 'noreply@test.com',
      });
      const result = service.getConfig();
      expect(result).toEqual({
        configured: true,
        provider: 'resend',
        domain: undefined,
        fromEmail: 'noreply@test.com',
      });
    });
  });

  describe('saveConfig', () => {
    it('writes config to local file', () => {
      service.saveConfig({ provider: 'resend', apiKey: 'key123' });
      expect(writeLocalEmailConfig).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'resend', apiKey: 'key123' }),
      );
    });
  });

  describe('testConfig', () => {
    it('returns success when provider sends successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue(true);
      (createProvider as jest.Mock).mockReturnValue({ send: mockSend });

      const result = await service.testConfig(
        { provider: 'resend', apiKey: 'key123' },
        'user@test.com',
      );

      expect(result).toEqual({ success: true });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          html: '<html>rendered</html>',
          text: 'plain text version',
        }),
      );
    });

    it('returns error when provider fails', async () => {
      const mockSend = jest.fn().mockResolvedValue(false);
      (createProvider as jest.Mock).mockReturnValue({ send: mockSend });

      const result = await service.testConfig(
        { provider: 'resend', apiKey: 'key123' },
        'user@test.com',
      );

      expect(result).toEqual({ success: false, error: 'Provider returned failure' });
    });

    it('returns error on exception', async () => {
      (createProvider as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid provider');
      });

      const result = await service.testConfig(
        { provider: 'unknown' as never, apiKey: 'key123' },
        'user@test.com',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid provider');
    });
  });

  describe('clearConfig', () => {
    it('clears local email config', () => {
      service.clearConfig();
      expect(clearLocalEmailConfig).toHaveBeenCalled();
    });
  });
});

describe('EmailConfigService (cloud mode)', () => {
  let service: EmailConfigService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MANIFEST_MODE: 'cloud' };
    service = new EmailConfigService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('getConfig returns Mailgun status from env vars', () => {
    process.env['MAILGUN_API_KEY'] = 'mg-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.test.com';
    // Need to re-create service to pick up env changes
    service = new EmailConfigService();

    const result = service.getConfig();
    expect(result.configured).toBe(true);
    expect(result.provider).toBe('mailgun');
  });

  it('saveConfig throws BadRequestException', () => {
    expect(() => service.saveConfig({ provider: 'resend', apiKey: 'key' }))
      .toThrow(BadRequestException);
  });

  it('clearConfig throws BadRequestException', () => {
    expect(() => service.clearConfig()).toThrow(BadRequestException);
  });
});
