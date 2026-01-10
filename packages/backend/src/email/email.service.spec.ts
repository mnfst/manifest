import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';
import { TEMPLATE_ENGINE } from './templates/engine/template-engine.interface';
import { EmailTemplateType } from '@chatgpt-app-builder/shared';

describe('EmailService', () => {
  let service: EmailService;
  let mockProvider: {
    send: jest.Mock;
    isConfigured: jest.Mock;
    getName: jest.Mock;
  };
  let mockTemplateEngine: {
    render: jest.Mock;
    preview: jest.Mock;
    getAvailableTemplates: jest.Mock;
    getSubject: jest.Mock;
    validateProps: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    mockProvider = {
      send: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
      getName: jest.fn().mockReturnValue('mock'),
    };

    mockTemplateEngine = {
      render: jest.fn().mockResolvedValue({ html: '<html></html>', text: 'text' }),
      preview: jest.fn().mockResolvedValue('<html></html>'),
      getAvailableTemplates: jest.fn().mockReturnValue([EmailTemplateType.PASSWORD_RESET]),
      getSubject: jest.fn().mockReturnValue('Test Subject'),
      validateProps: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          EMAIL_FROM: 'test@example.com',
          EMAIL_FROM_NAME: 'Test App',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_PROVIDER, useValue: mockProvider },
        { provide: TEMPLATE_ENGINE, useValue: mockTemplateEngine },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPasswordReset', () => {
    const validProps = {
      userName: 'John Doe',
      resetLink: 'https://example.com/reset?token=abc123',
    };

    it('should send password reset email successfully', async () => {
      mockProvider.send.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        timestamp: new Date(),
      });

      const result = await service.sendPasswordReset('user@example.com', validProps);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTemplateEngine.render).toHaveBeenCalledWith(
        EmailTemplateType.PASSWORD_RESET,
        expect.objectContaining(validProps),
      );
      expect(mockProvider.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid email', async () => {
      await expect(service.sendPasswordReset('invalid-email', validProps)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty email', async () => {
      await expect(service.sendPasswordReset('', validProps)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle provider failure gracefully', async () => {
      mockProvider.send.mockResolvedValue({
        success: false,
        error: 'Provider error',
        timestamp: new Date(),
      });

      const result = await service.sendPasswordReset('user@example.com', validProps);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider error');
    });
  });

  describe('send', () => {
    it('should validate props before sending', async () => {
      mockTemplateEngine.validateProps.mockReturnValue({
        valid: false,
        errors: ['userName is required'],
      });

      await expect(
        service.send({
          to: 'user@example.com',
          template: EmailTemplateType.PASSWORD_RESET,
          props: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include replyTo in the message if provided', async () => {
      mockProvider.send.mockResolvedValue({
        success: true,
        messageId: 'test-id',
        timestamp: new Date(),
      });

      await service.send({
        to: 'user@example.com',
        template: EmailTemplateType.PASSWORD_RESET,
        props: { userName: 'Test', resetLink: 'https://example.com' },
        replyTo: 'support@example.com',
      });

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'support@example.com',
        }),
      );
    });

    it('should return error result when template rendering fails', async () => {
      mockTemplateEngine.render.mockRejectedValue(new Error('Render error'));

      const result = await service.send({
        to: 'user@example.com',
        template: EmailTemplateType.PASSWORD_RESET,
        props: { userName: 'Test', resetLink: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Render error');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return available templates from engine', () => {
      const templates = service.getAvailableTemplates();

      expect(templates).toEqual([EmailTemplateType.PASSWORD_RESET]);
      expect(mockTemplateEngine.getAvailableTemplates).toHaveBeenCalled();
    });
  });

  describe('previewTemplate', () => {
    it('should preview template', async () => {
      const html = await service.previewTemplate(EmailTemplateType.PASSWORD_RESET, {
        userName: 'Test',
        resetLink: 'https://example.com',
      });

      expect(html).toBe('<html></html>');
      expect(mockTemplateEngine.preview).toHaveBeenCalled();
    });
  });

  describe('getConfigStatus', () => {
    it('should return configuration status', () => {
      const status = service.getConfigStatus();

      expect(status.provider).toBe('mock');
      expect(status.configured).toBe(true);
      expect(status.from).toBe('test@example.com');
    });
  });

  describe('isConfigured', () => {
    it('should return provider configuration status', () => {
      expect(service.isConfigured()).toBe(true);

      mockProvider.isConfigured.mockReturnValue(false);
      expect(service.isConfigured()).toBe(false);
    });
  });
});
