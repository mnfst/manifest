import { Injectable, Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import { ThresholdAlertEmail, ThresholdAlertProps } from '../emails/threshold-alert';
import { sendMailgunEmail } from './mailgun';

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);

  async sendThresholdAlert(to: string, props: ThresholdAlertProps): Promise<boolean> {
    const html = await render(ThresholdAlertEmail(props));
    const subject = `Alert: ${props.agentName} exceeded ${props.metricType} threshold`;

    const sent = await sendMailgunEmail({ to, subject, html, from: `Manifest <${process.env['NOTIFICATION_FROM_EMAIL'] ?? 'noreply@manifest.build'}>` });
    if (sent) {
      this.logger.log(`Threshold alert sent to ${to} for agent ${props.agentName}`);
    }
    return sent;
  }
}
