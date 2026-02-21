jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html>rendered</html>'),
}));

jest.mock('./mailgun', () => ({
  sendMailgunEmail: jest.fn(),
}));

jest.mock('../emails/threshold-alert', () => ({
  ThresholdAlertEmail: jest.fn(() => 'mock-element'),
}));

import { NotificationEmailService } from './notification-email.service';
import { sendMailgunEmail } from './mailgun';

describe('NotificationEmailService', () => {
  let service: NotificationEmailService;

  beforeEach(() => {
    service = new NotificationEmailService();
    jest.clearAllMocks();
  });

  it('sends threshold alert email', async () => {
    (sendMailgunEmail as jest.Mock).mockResolvedValue(true);

    const result = await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'tokens',
      threshold: 1000,
      actualValue: 1500,
      period: 'hour',
      timestamp: '2024-01-01T00:00:00Z',
    });

    expect(result).toBe(true);
    expect(sendMailgunEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: expect.stringContaining('demo-agent'),
      }),
    );
  });

  it('returns false when mailgun fails', async () => {
    (sendMailgunEmail as jest.Mock).mockResolvedValue(false);

    const result = await service.sendThresholdAlert('user@test.com', {
      agentName: 'demo-agent',
      metricType: 'cost',
      threshold: 50,
      actualValue: 75,
      period: 'day',
      timestamp: '2024-01-01T12:00:00Z',
    });

    expect(result).toBe(false);
  });
});
