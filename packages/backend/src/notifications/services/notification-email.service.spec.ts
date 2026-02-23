import { ThresholdAlertProps } from '../emails/threshold-alert';

/* Mock external dependencies */
jest.mock('@react-email/render', () => ({
  render: jest.fn().mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
    Promise.resolve(opts?.plainText ? 'plain text version' : '<html>rendered</html>'),
  ),
}));

jest.mock('./email-providers/send-email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../emails/threshold-alert', () => ({
  ThresholdAlertEmail: jest.fn(() => 'mock-element'),
}));

import { NotificationEmailService } from './notification-email.service';
import { render } from '@react-email/render';
import { sendEmail } from './email-providers/send-email';

const mockRender = render as jest.Mock;
const mockSend = sendEmail as jest.Mock;

const baseProps: ThresholdAlertProps = {
  agentName: 'demo-agent',
  metricType: 'tokens',
  threshold: 10000,
  actualValue: 15000,
  period: '24h',
  timestamp: '2025-06-01T00:00:00Z',
};

describe('NotificationEmailService', () => {
  let service: NotificationEmailService;

  beforeEach(() => {
    service = new NotificationEmailService();
    mockRender.mockClear();
    mockSend.mockClear();
    mockRender.mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
      Promise.resolve(opts?.plainText ? 'plain text version' : '<html>rendered</html>'),
    );
    mockSend.mockResolvedValue(true);
  });

  it('should render the email template and send via email provider', async () => {
    const result = await service.sendThresholdAlert('user@test.com', baseProps);

    expect(mockRender).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Alert: demo-agent exceeded tokens threshold',
        html: '<html>rendered</html>',
        text: 'plain text version',
      }),
    );
    expect(result).toBe(true);
  });

  it('should format subject with agent name and metric type', async () => {
    const costProps: ThresholdAlertProps = { ...baseProps, metricType: 'cost', agentName: 'my-bot' };

    await service.sendThresholdAlert('user@test.com', costProps);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Alert: my-bot exceeded cost threshold',
      }),
    );
  });

  it('should use NOTIFICATION_FROM_EMAIL env var in from field', async () => {
    process.env['NOTIFICATION_FROM_EMAIL'] = 'alerts@custom.com';

    await service.sendThresholdAlert('user@test.com', baseProps);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Manifest <alerts@custom.com>',
      }),
    );

    delete process.env['NOTIFICATION_FROM_EMAIL'];
  });

  it('should fall back to default from email', async () => {
    delete process.env['NOTIFICATION_FROM_EMAIL'];

    await service.sendThresholdAlert('user@test.com', baseProps);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Manifest <noreply@manifest.build>',
      }),
    );
  });

  it('should return false when email send fails', async () => {
    mockSend.mockResolvedValue(false);

    const result = await service.sendThresholdAlert('user@test.com', baseProps);

    expect(result).toBe(false);
  });

  it('should return true and log on success', async () => {
    const logSpy = jest.spyOn(
      (service as unknown as { logger: { log: (...args: unknown[]) => void } }).logger,
      'log',
    );

    const result = await service.sendThresholdAlert('user@test.com', baseProps);

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('demo-agent'),
    );
  });
});
