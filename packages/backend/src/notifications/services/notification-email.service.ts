import { Injectable, Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import { ThresholdAlertEmail, ThresholdAlertProps } from '../emails/threshold-alert';
import { sendEmail } from './email-providers/send-email';

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);

  async sendThresholdAlert(to: string, props: ThresholdAlertProps): Promise<boolean> {
    const element = ThresholdAlertEmail(props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = `Alert: ${props.agentName} exceeded ${props.metricType} threshold`;

    const sent = await sendEmail({ to, subject, html, text, from: `Manifest <${process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build'}>` });
    if (sent) {
      this.logger.log(`Threshold alert sent to ${to} for agent ${props.agentName}`);
    }
    return sent;
  }
}
