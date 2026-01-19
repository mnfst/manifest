import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailTemplateType } from '@manifest/shared';

describe('EmailController', () => {
  let controller: EmailController;
  let mockEmailService: {
    previewTemplate: jest.Mock;
  };

  beforeEach(async () => {
    mockEmailService = {
      previewTemplate: jest.fn().mockResolvedValue('<html>Preview</html>'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [{ provide: EmailService, useValue: mockEmailService }],
    }).compile();

    controller = module.get<EmailController>(EmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('previewTemplate', () => {
    it('should return preview HTML for valid template', async () => {
      const result = await controller.previewTemplate('password-reset', {});

      expect(result).toBe('<html>Preview</html>');
      expect(mockEmailService.previewTemplate).toHaveBeenCalledWith(
        EmailTemplateType.PASSWORD_RESET,
        expect.any(Object),
      );
    });

    it('should throw BadRequestException for invalid template', async () => {
      await expect(
        controller.previewTemplate('invalid-template', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should merge provided props with defaults', async () => {
      await controller.previewTemplate('password-reset', {
        userName: 'Custom User',
      });

      expect(mockEmailService.previewTemplate).toHaveBeenCalledWith(
        EmailTemplateType.PASSWORD_RESET,
        expect.objectContaining({
          userName: 'Custom User',
          resetLink: expect.any(String),
        }),
      );
    });

    it('should use default props when none provided', async () => {
      await controller.previewTemplate('password-reset', {});

      expect(mockEmailService.previewTemplate).toHaveBeenCalledWith(
        EmailTemplateType.PASSWORD_RESET,
        expect.objectContaining({
          userName: 'John Doe',
          resetLink: expect.any(String),
        }),
      );
    });
  });
});
