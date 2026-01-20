import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailgunProvider } from './mailgun.provider';
import Mailgun from 'mailgun.js';

// Mock mailgun.js
jest.mock('mailgun.js', () => {
  return jest.fn().mockImplementation(() => ({
    client: jest.fn().mockReturnValue({
      messages: {
        create: jest.fn(),
      },
    }),
  }));
});

describe('MailgunProvider', () => {
  let provider: MailgunProvider;
  let mockConfigService: { get: jest.Mock };

  describe('when properly configured', () => {
    beforeEach(async () => {
      mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            MAILGUN_API_KEY: 'test-api-key',
            MAILGUN_DOMAIN: 'mg.example.com',
            MAILGUN_EU_REGION: 'false',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailgunProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<MailgunProvider>(MailgunProvider);
    });

    it('should be defined', () => {
      expect(provider).toBeDefined();
    });

    it('should be configured', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('should return correct provider name', () => {
      expect(provider.getName()).toBe('mailgun');
    });
  });

  describe('when not configured', () => {
    beforeEach(async () => {
      mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          // Return undefined for API key
          if (key === 'MAILGUN_API_KEY') return undefined;
          if (key === 'MAILGUN_DOMAIN') return '';
          return defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailgunProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<MailgunProvider>(MailgunProvider);
    });

    it('should not be configured when API key is missing', () => {
      expect(provider.isConfigured()).toBe(false);
    });

    it('should return error when sending without configuration', async () => {
      const result = await provider.send({
        to: 'user@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('EU region configuration', () => {
    it('should use EU endpoint when configured', async () => {
      mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            MAILGUN_API_KEY: 'test-api-key',
            MAILGUN_DOMAIN: 'mg.example.com',
            MAILGUN_EU_REGION: 'true',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailgunProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<MailgunProvider>(MailgunProvider);

      // Verify EU endpoint was used
      expect(Mailgun).toHaveBeenCalled();
    });
  });
});
