jest.mock('@react-email/render', () => ({
  render: jest
    .fn()
    .mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
      Promise.resolve(opts?.plainText ? 'plain text version' : '<html>rendered</html>'),
    ),
}));

jest.mock('./email-providers/send-email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('./email-providers/resolve-provider', () => ({
  createProvider: jest.fn(() => ({
    send: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../emails/threshold-alert', () => ({
  ThresholdAlertEmail: jest.fn(() => 'mock-element'),
}));

import { ConfigService } from '@nestjs/config';
import { NotificationEmailService } from './notification-email.service';
import { sendEmail } from './email-providers/send-email';
import { createProvider } from './email-providers/resolve-provider';

function createMockConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    'app.notificationFromEmail': 'noreply@manifest.build',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('NotificationEmailService', () => {
  let service: NotificationEmailService;

  beforeEach(() => {
    service = new NotificationEmailService(createMockConfig());
    jest.clearAllMocks();
  });

  it('sends threshold alert email', async () => {
    (sendEmail as jest.Mock).mockResolvedValue(true);

    const result = await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'tokens',
      threshold: 1000,
      actualValue: 1500,
      period: 'hour',
      timestamp: '2024-01-01T00:00:00Z',
      agentUrl: 'http://localhost:3001/agents/demo-agent',
    });

    expect(result).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: expect.stringContaining('demo-agent'),
        html: '<html>rendered</html>',
        text: 'plain text version',
      }),
    );
  });

  it('returns false when email send fails', async () => {
    (sendEmail as jest.Mock).mockResolvedValue(false);

    const result = await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'cost',
      threshold: 50,
      actualValue: 75,
      period: 'day',
      timestamp: '2024-01-01T12:00:00Z',
      agentUrl: 'http://localhost:3001/agents/demo-agent',
    });

    expect(result).toBe(false);
  });

  it('sends via custom provider when providerConfig is given', async () => {
    const mockSend = jest.fn().mockResolvedValue(true);
    (createProvider as jest.Mock).mockReturnValue({ send: mockSend });

    const result = await service.sendThresholdAlert(
      'user@test.com',
      {
        agentName: 'demo-agent',
        metricType: 'tokens',
        threshold: 1000,
        actualValue: 1500,
        period: 'hour',
        timestamp: '2024-01-01T00:00:00Z',
        agentUrl: 'http://localhost:3001/agents/demo-agent',
      },
      {
        provider: 'resend',
        apiKey: 're_testkey123',
        domain: 'mg.example.com',
      },
    );

    expect(result).toBe(true);
    expect(createProvider).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'resend', apiKey: 're_testkey123' }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        from: 'Manifest <noreply@mg.example.com>',
      }),
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('uses default from address when no domain in provider config', async () => {
    const mockSend = jest.fn().mockResolvedValue(true);
    (createProvider as jest.Mock).mockReturnValue({ send: mockSend });

    await service.sendThresholdAlert(
      'user@test.com',
      {
        agentName: 'demo-agent',
        metricType: 'cost',
        threshold: 50,
        actualValue: 75,
        period: 'day',
        timestamp: '2024-01-01T12:00:00Z',
        agentUrl: 'http://localhost:3001/agents/demo-agent',
      },
      {
        provider: 'sendgrid',
        apiKey: 'SG.testkey123456',
        domain: null,
      },
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('Manifest <'),
      }),
    );
  });

  it('returns false when custom provider send fails', async () => {
    (createProvider as jest.Mock).mockReturnValue({
      send: jest.fn().mockResolvedValue(false),
    });

    const result = await service.sendThresholdAlert(
      'user@test.com',
      {
        agentName: 'demo-agent',
        metricType: 'tokens',
        threshold: 1000,
        actualValue: 1500,
        period: 'hour',
        timestamp: '2024-01-01T00:00:00Z',
        agentUrl: 'http://localhost:3001/agents/demo-agent',
      },
      {
        provider: 'resend',
        apiKey: 're_testkey123',
        domain: null,
      },
    );

    expect(result).toBe(false);
  });

  it('uses "Warning:" subject prefix for soft alerts', async () => {
    (sendEmail as jest.Mock).mockResolvedValue(true);

    await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'tokens',
      threshold: 1000,
      actualValue: 1500,
      period: 'hour',
      timestamp: '2024-01-01T00:00:00Z',
      agentUrl: 'http://localhost:3001/agents/demo-agent',
      alertType: 'soft',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Warning: demo-agent exceeded tokens threshold',
      }),
    );
  });

  it('uses "Blocked:" subject prefix for hard alerts', async () => {
    (sendEmail as jest.Mock).mockResolvedValue(true);

    await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'cost',
      threshold: 50,
      actualValue: 75,
      period: 'day',
      timestamp: '2024-01-01T12:00:00Z',
      agentUrl: 'http://localhost:3001/agents/demo-agent',
      alertType: 'hard',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Blocked: demo-agent reached cost limit',
      }),
    );
  });

  it('defaults to "Blocked:" subject when alertType is not set', async () => {
    (sendEmail as jest.Mock).mockResolvedValue(true);

    await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'tokens',
      threshold: 1000,
      actualValue: 1500,
      period: 'hour',
      timestamp: '2024-01-01T00:00:00Z',
      agentUrl: 'http://localhost:3001/agents/demo-agent',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Blocked: demo-agent reached tokens limit',
      }),
    );
  });
});
