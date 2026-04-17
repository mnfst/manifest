jest.mock('../auth/auth.instance', () => ({
  auth: { api: { signUpEmail: jest.fn() } },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';

describe('SetupController', () => {
  let controller: SetupController;
  let mockNeedsSetup: jest.Mock;
  let mockCreateFirstAdmin: jest.Mock;
  let mockGetEnabledSocialProviders: jest.Mock;
  let mockIsLocalMode: jest.Mock;
  let mockIsOllamaAvailable: jest.Mock;

  beforeEach(async () => {
    mockNeedsSetup = jest.fn();
    mockCreateFirstAdmin = jest.fn();
    mockGetEnabledSocialProviders = jest.fn().mockReturnValue([]);
    mockIsLocalMode = jest.fn().mockReturnValue(false);
    mockIsOllamaAvailable = jest.fn().mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetupController],
      providers: [
        {
          provide: SetupService,
          useValue: {
            needsSetup: mockNeedsSetup,
            createFirstAdmin: mockCreateFirstAdmin,
            getEnabledSocialProviders: mockGetEnabledSocialProviders,
            isLocalMode: mockIsLocalMode,
            isOllamaAvailable: mockIsOllamaAvailable,
          },
        },
      ],
    }).compile();

    controller = module.get<SetupController>(SetupController);
  });

  describe('getStatus', () => {
    it('returns needsSetup=true with empty socialProviders in cloud mode', async () => {
      mockNeedsSetup.mockResolvedValue(true);
      const result = await controller.getStatus();
      expect(result).toEqual({
        needsSetup: true,
        socialProviders: [],
        isLocalMode: false,
        ollamaAvailable: false,
      });
    });

    it('returns needsSetup=false with empty socialProviders in cloud mode', async () => {
      mockNeedsSetup.mockResolvedValue(false);
      const result = await controller.getStatus();
      expect(result).toEqual({
        needsSetup: false,
        socialProviders: [],
        isLocalMode: false,
        ollamaAvailable: false,
      });
    });

    it('includes enabled social providers in the response', async () => {
      mockNeedsSetup.mockResolvedValue(false);
      mockGetEnabledSocialProviders.mockReturnValue(['google', 'github']);
      const result = await controller.getStatus();
      expect(result).toEqual({
        needsSetup: false,
        socialProviders: ['google', 'github'],
        isLocalMode: false,
        ollamaAvailable: false,
      });
    });

    it('returns isLocalMode=true when in local mode', async () => {
      mockNeedsSetup.mockResolvedValue(false);
      mockIsLocalMode.mockReturnValue(true);
      mockIsOllamaAvailable.mockResolvedValue(false);
      const result = await controller.getStatus();
      expect(result).toEqual({
        needsSetup: false,
        socialProviders: [],
        isLocalMode: true,
        ollamaAvailable: false,
      });
    });

    it('returns ollamaAvailable=true when in local mode and Ollama is reachable', async () => {
      mockNeedsSetup.mockResolvedValue(false);
      mockIsLocalMode.mockReturnValue(true);
      mockIsOllamaAvailable.mockResolvedValue(true);
      const result = await controller.getStatus();
      expect(result).toEqual({
        needsSetup: false,
        socialProviders: [],
        isLocalMode: true,
        ollamaAvailable: true,
      });
    });

    it('skips Ollama check in cloud mode (always false)', async () => {
      mockNeedsSetup.mockResolvedValue(false);
      mockIsLocalMode.mockReturnValue(false);
      const result = await controller.getStatus();
      expect(result.ollamaAvailable).toBe(false);
      expect(mockIsOllamaAvailable).not.toHaveBeenCalled();
    });
  });

  describe('createAdmin', () => {
    const dto = {
      email: 'founder@example.com',
      name: 'Founder',
      password: 'secret-password',
    };

    it('delegates to service and returns ok', async () => {
      mockCreateFirstAdmin.mockResolvedValue(undefined);
      const result = await controller.createAdmin(dto);

      expect(result).toEqual({ ok: true });
      expect(mockCreateFirstAdmin).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      mockCreateFirstAdmin.mockRejectedValue(new Error('already exists'));
      await expect(controller.createAdmin(dto)).rejects.toThrow('already exists');
    });
  });
});
