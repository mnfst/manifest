import { Test, TestingModule } from '@nestjs/testing';
import { EmailConfigController } from './email-config.controller';
import { EmailConfigService } from './services/email-config.service';
import { NotificationEmailAddressService } from './services/notification-email-address.service';

describe('EmailConfigController', () => {
  let controller: EmailConfigController;
  let mockGetConfig: jest.Mock;
  let mockSaveConfig: jest.Mock;
  let mockTestConfig: jest.Mock;
  let mockClearConfig: jest.Mock;
  let mockGetNotificationEmail: jest.Mock;
  let mockSaveNotificationEmail: jest.Mock;

  beforeEach(async () => {
    mockGetConfig = jest.fn();
    mockSaveConfig = jest.fn();
    mockTestConfig = jest.fn();
    mockClearConfig = jest.fn();
    mockGetNotificationEmail = jest.fn();
    mockSaveNotificationEmail = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailConfigController],
      providers: [
        {
          provide: EmailConfigService,
          useValue: {
            getConfig: mockGetConfig,
            saveConfig: mockSaveConfig,
            testConfig: mockTestConfig,
            clearConfig: mockClearConfig,
          },
        },
        {
          provide: NotificationEmailAddressService,
          useValue: {
            getNotificationEmail: mockGetNotificationEmail,
            saveNotificationEmail: mockSaveNotificationEmail,
          },
        },
      ],
    }).compile();

    controller = module.get(EmailConfigController);
  });

  it('GET returns config status', () => {
    mockGetConfig.mockReturnValue({ configured: true, provider: 'resend' });
    const result = controller.getConfig();
    expect(result).toEqual({ configured: true, provider: 'resend' });
  });

  it('POST saves config and returns saved: true', () => {
    const dto = { provider: 'resend' as const, apiKey: 'key123' };
    const result = controller.saveConfig(dto);
    expect(mockSaveConfig).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ saved: true });
  });

  it('POST /test calls testConfig with dto and to address', async () => {
    mockTestConfig.mockResolvedValue({ success: true });
    const dto = { to: 'user@test.com', provider: 'resend' as const, apiKey: 'key123' };

    const result = await controller.testConfig(dto);

    expect(mockTestConfig).toHaveBeenCalledWith(dto, 'user@test.com');
    expect(result).toEqual({ success: true });
  });

  it('DELETE clears config and returns cleared: true', () => {
    const result = controller.clearConfig();
    expect(mockClearConfig).toHaveBeenCalled();
    expect(result).toEqual({ cleared: true });
  });

  it('GET /notification-email returns notification email', () => {
    mockGetNotificationEmail.mockReturnValue({ email: 'user@real.com', isDefault: false });
    const result = controller.getNotificationEmail();
    expect(result).toEqual({ email: 'user@real.com', isDefault: false });
  });

  it('GET /notification-email returns null when not set', () => {
    mockGetNotificationEmail.mockReturnValue({ email: null, isDefault: true });
    const result = controller.getNotificationEmail();
    expect(result).toEqual({ email: null, isDefault: true });
  });

  it('POST /notification-email saves email and returns saved: true', () => {
    const result = controller.saveNotificationEmail({ email: 'user@real.com' });
    expect(mockSaveNotificationEmail).toHaveBeenCalledWith('user@real.com');
    expect(result).toEqual({ saved: true });
  });
});
